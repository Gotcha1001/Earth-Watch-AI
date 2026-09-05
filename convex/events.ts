import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

// Buckets lat/lon to ~0.2° (~20km) so a reissued/updated alert for the same
// storm/warning collapses onto the same row instead of stacking as a "new"
// event just because the source gave the update a fresh id.
function computeDedupeKey(event: {
  source: string;
  title: string;
  latitude: number;
  longitude: number;
}): string {
  const latBucket = Math.round(event.latitude * 5) / 5;
  const lonBucket = Math.round(event.longitude * 5) / 5;
  return `${event.source}|${event.title}|${latBucket}|${lonBucket}`;
}

export const upsertEvents = internalMutation({
  args: {
    events: v.array(
      v.object({
        externalId: v.string(),
        source: v.union(
          v.literal("usgs"),
          v.literal("eonet"),
          v.literal("noaa"),
          v.literal("gvp"),
          v.literal("news"),
        ),
        category: v.union(
          v.literal("earthquake"),
          v.literal("wildfire"),
          v.literal("flood"),
          v.literal("storm"),
          v.literal("volcano"),
          v.literal("severeWeather"),
          v.literal("landslide"), // NEW
          v.literal("iceberg"), // NEW
          v.literal("tsunami"), // NEW
        ),
        title: v.string(),
        description: v.optional(v.union(v.string(), v.null())),
        locationName: v.optional(v.union(v.string(), v.null())),
        latitude: v.number(),
        longitude: v.number(),
        severity: v.number(),
        rawSeverityLabel: v.string(),
        occurredAt: v.number(),
        sourceUrl: v.optional(v.union(v.string(), v.null())),
      }),
    ),
  },
  handler: async (ctx, { events }) => {
    const now = Date.now();
    let failures = 0;
    let matchedByExternalId = 0;
    let matchedByDedupeKey = 0;
    let inserted = 0;

    for (const rawEvent of events) {
      try {
        const event = {
          ...rawEvent,
          description: rawEvent.description ?? undefined,
          locationName: rawEvent.locationName ?? undefined,
          sourceUrl: rawEvent.sourceUrl ?? undefined,
        };
        const dedupeKey = computeDedupeKey(event);

        const existingByExternalId = await ctx.db
          .query("disasterEvents")
          .withIndex("by_externalId", (q) =>
            q.eq("externalId", event.externalId),
          )
          .unique();

        if (existingByExternalId) {
          await ctx.db.patch(existingByExternalId._id, {
            severity: event.severity,
            occurredAt: event.occurredAt,
            description: event.description,
            // Only overwrite if this tick actually gave us a name — an
            // ingest tick with no name (or a source that doesn't provide
            // one) should never wipe out a value geocodeBackfill already
            // filled in for this event.
            ...(event.locationName ? { locationName: event.locationName } : {}),
            sourceUrl: event.sourceUrl,
            status: "active",
            ingestedAt: now,
            dedupeKey,
          });
          matchedByExternalId += 1;
          continue;
        }

        // No exact externalId match — check for an active event that's
        // functionally the same warning under a different id (NOAA's case).
        const existingByDedupeKey = await ctx.db
          .query("disasterEvents")
          .withIndex("by_dedupeKey_status", (q) =>
            q.eq("dedupeKey", dedupeKey).eq("status", "active"),
          )
          .first();

        if (existingByDedupeKey) {
          await ctx.db.patch(existingByDedupeKey._id, {
            externalId: event.externalId, // adopt the newest id for this warning
            severity: event.severity,
            occurredAt: event.occurredAt,
            description: event.description,
            ...(event.locationName ? { locationName: event.locationName } : {}),
            sourceUrl: event.sourceUrl,
            status: "active",
            ingestedAt: now,
          });
          matchedByDedupeKey += 1;
          continue;
        }

        await ctx.db.insert("disasterEvents", {
          ...event,
          dedupeKey,
          ingestedAt: now,
          status: "active",
        });
        inserted += 1;
      } catch (error) {
        // Isolate the failure to this one event — a single malformed
        // record (bad field, unexpected shape, etc.) should never cost us
        // the other ~99 events in the same ingest tick.
        failures += 1;
        console.error(
          `[events] upsertEvents failed for externalId=${rawEvent.externalId}:`,
          error,
        );
      }
    }

    console.log(
      `[events] upsertEvents: ${inserted} inserted, ${matchedByExternalId} updated (id match), ${matchedByDedupeKey} updated (dedupe match), ${failures} failed`,
    );
  },
});

export const resolveStaleEvents = internalMutation({
  args: { olderThanMs: v.number() },
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - olderThanMs;
    const stale = await ctx.db
      .query("disasterEvents")
      .withIndex("by_occurredAt", (q) => q.lt("occurredAt", cutoff))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          // Volcanoes use occurredAt as the eruption's START date, which is
          // routinely >48h old for a long-running eruption GVP still lists
          // as ongoing. resolveEndedVolcanoes (below) owns their lifecycle
          // instead — this sweep would otherwise resolve them wrongly.
          q.neq(q.field("category"), "volcano"),
        ),
      )
      .collect();
    for (const event of stale) {
      await ctx.db.patch(event._id, { status: "resolved" });
    }
  },
});

// GVP's WFS query (EndDateYear IS NULL) is itself the authoritative
// "still erupting" list. So instead of guessing staleness from a
// timestamp, just diff: any volcano we have marked "active" whose
// externalId did NOT come back in this tick's fetch has ended.
export const resolveEndedVolcanoes = internalMutation({
  args: { activeExternalIds: v.array(v.string()) },
  handler: async (ctx, { activeExternalIds }) => {
    const stillActive = new Set(activeExternalIds);
    const activeVolcanoes = await ctx.db
      .query("disasterEvents")
      .withIndex("by_status_category", (q) =>
        q.eq("status", "active").eq("category", "volcano"),
      )
      .collect();

    let resolved = 0;
    for (const volcano of activeVolcanoes) {
      if (!stillActive.has(volcano.externalId)) {
        await ctx.db.patch(volcano._id, { status: "resolved" });
        resolved += 1;
      }
    }
    if (resolved > 0) {
      console.log(
        `[events] resolveEndedVolcanoes: ${resolved} eruption(s) ended`,
      );
    }
  },
});

// convex/events.ts
const VOLCANO_LIVE_MAP_WINDOW_MS = 1000 * 60 * 60 * 48; // same freshness window resolveStaleEvents uses for everything else

export const listActiveEvents = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - VOLCANO_LIVE_MAP_WINDOW_MS;

    const nonVolcano = await ctx.db
      .query("disasterEvents")
      .withIndex("by_status_category", (q) => q.eq("status", "active"))
      .filter((q) => q.neq(q.field("category"), "volcano"))
      .order("desc")
      .take(500);

    const newVolcanoes = await ctx.db
      .query("disasterEvents")
      .withIndex("by_status_category", (q) =>
        q.eq("status", "active").eq("category", "volcano"),
      )
      .filter((q) => q.gt(q.field("occurredAt"), cutoff))
      .order("desc")
      .take(10); // there should only ever be ~0–1 of these

    return [...nonVolcano, ...newVolcanoes];
  },
});

// Used only by the risk-engine action — same data, internal-only entry point.
export const listActiveEventsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("disasterEvents")
      .withIndex("by_status_category", (q) => q.eq("status", "active"))
      .collect();
  },
});

// Wipes the entire disasterEvents table. This is global data (not scoped to
// any one user's watched regions), so this clears what every user sees on
// the Live Map and dashboard, not just the caller's own view. Requires an
// authenticated user to avoid this being callable anonymously.
export const clearAllEvents = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be signed in to reset events.");
    }
    const all = await ctx.db.query("disasterEvents").collect();
    for (const event of all) {
      await ctx.db.delete(event._id);
    }
    return all.length;
  },
});

// Used only by geocodeBackfill.ts once a reverse-geocode lookup resolves.
export const patchLocationName = internalMutation({
  args: { eventId: v.id("disasterEvents"), locationName: v.string() },
  handler: async (ctx, { eventId, locationName }) => {
    await ctx.db.patch(eventId, { locationName });
  },
});

// Used only by geocodeBackfill.ts to find events still missing a name.
// Not indexed — fine at this table's scale, and only runs once a minute.
export const listEventsMissingLocationName = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    return ctx.db
      .query("disasterEvents")
      .filter((q) => q.eq(q.field("locationName"), undefined))
      .take(limit);
  },
});

// Same "by_status_category" index as listActiveEvents, but this time both
// fields get an equality clause instead of just "status" — so the query
// scans *only* the volcano rows, and isn't competing for a slice of a
// shared take(500) with earthquakes/wildfires/etc. Without this, the
// wildfire/storm/etc. rows that sort ahead of "volcano" in descending
// category order were crowding almost all volcano rows out of the cap.
export const listActiveVolcanoes = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("disasterEvents")
      .withIndex("by_status_category", (q) =>
        q.eq("status", "active").eq("category", "volcano"),
      )
      .order("desc")
      .take(200); // GVP ingestion itself is already capped at 50/tick, so
    // this just needs to be comfortably above that.
  },
});

// convex/events.ts

// GVP re-confirms every still-erupting volcano on every successful ingest
// tick (every 5 min). "Erupting" for this page is therefore defined purely
// as "GVP confirmed it recently" -- it deliberately ignores `status`,
// because `status` on this table is driven by resolveStaleEvents' 48h
// occurredAt rule, which exists for the live map's point-in-time events
// (earthquakes, storms) and says nothing about whether an eruption is
// ongoing. That rule keeps running unchanged and keeps the live map
// showing just the newest volcano -- this query never looks at it.
const VOLCANO_RECENTLY_CONFIRMED_MS = 1000 * 60 * 30; // ~6 missed 5-min ticks of grace

export const listErupting = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - VOLCANO_RECENTLY_CONFIRMED_MS;
    return ctx.db
      .query("disasterEvents")
      .withIndex("by_category_ingestedAt", (q) =>
        q.eq("category", "volcano").gt("ingestedAt", cutoff),
      )
      .collect();
  },
});
