// convex/events.ts — default (non-node) runtime: mutations + queries only.
// The fetch-based ingestion action that calls these lives in
// convex/eventsIngest.ts because "use node" files may only export actions.

import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const upsertEvents = internalMutation({
  args: {
    events: v.array(
      v.object({
        externalId: v.string(),
        source: v.union(
          v.literal("usgs"),
          v.literal("eonet"),
          v.literal("noaa"),
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
        // Source APIs (EONET in particular) sometimes send explicit `null`
        // for a missing optional field rather than omitting the key.
        // v.optional() alone only accepts `undefined`, so we widen these to
        // accept null too and normalize to undefined below, after validation
        // has already passed — normalizing inside the handler doesn't help
        // if the validator (which runs first) rejects the null before the
        // handler body ever executes.
        description: v.optional(v.union(v.string(), v.null())),
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

    for (const rawEvent of events) {
      try {
        // Normalize null -> undefined so the stored doc matches the schema's
        // v.optional(v.string()) shape.
        const event = {
          ...rawEvent,
          description: rawEvent.description ?? undefined,
          sourceUrl: rawEvent.sourceUrl ?? undefined,
        };

        const existing = await ctx.db
          .query("disasterEvents")
          .withIndex("by_externalId", (q) =>
            q.eq("externalId", event.externalId),
          )
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            severity: event.severity,
            status: "active",
            ingestedAt: now,
          });
        } else {
          await ctx.db.insert("disasterEvents", {
            ...event,
            ingestedAt: now,
            status: "active",
          });
        }
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

    if (failures > 0) {
      console.error(
        `[events] upsertEvents: ${failures}/${events.length} events failed`,
      );
    }
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
