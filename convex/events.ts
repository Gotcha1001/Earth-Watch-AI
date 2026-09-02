// convex/events.ts — default (non-node) runtime: mutations + queries only.
// The fetch-based ingestion action that calls these lives in
// convex/eventsIngest.ts because "use node" files may only export actions.

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
        ),
        category: v.union(
          v.literal("earthquake"),
          v.literal("wildfire"),
          v.literal("flood"),
          v.literal("storm"),
          v.literal("volcano"),
          v.literal("severeWeather"),
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
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    for (const event of stale) {
      await ctx.db.patch(event._id, { status: "resolved" });
    }
  },
});

export const listActiveEvents = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("disasterEvents")
      .withIndex("by_status_category", (q) => q.eq("status", "active"))
      .order("desc")
      .take(500);
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
