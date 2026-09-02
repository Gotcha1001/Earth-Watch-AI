// convex/geocodeBackfill.ts
// Fills in a human-readable locationName for events that don't have one
// yet, a handful at a time, via the shared throttled queue in
// lib/geocode.ts. Runs on its own cron so a burst of new events never
// blocks or slows down ingestAll itself.
"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { reverseGeocode, shortLocationName } from "../lib/geocode";

// ~15 * 1.1s ≈ 16s per run — comfortably inside one action invocation,
// and enough to keep pace with the handful of genuinely-new events a
// typical 5-minute ingest tick produces.
const BATCH_SIZE = 15;

export const backfillLocationNames = internalAction({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.runQuery(
      internal.events.listEventsMissingLocationName,
      { limit: BATCH_SIZE },
    );
    if (events.length === 0) return;

    for (const event of events) {
      try {
        const result = await reverseGeocode(event.latitude, event.longitude);
        const locationName = result?.display_name
          ? shortLocationName(result.display_name)
          : `${event.latitude.toFixed(2)}, ${event.longitude.toFixed(2)}`;
        await ctx.runMutation(internal.events.patchLocationName, {
          eventId: event._id,
          locationName,
        });
      } catch (error) {
        // Leave locationName unset — it'll be picked up again next tick.
        console.error(
          `[geocodeBackfill] failed for event ${event._id}:`,
          error,
        );
      }
    }
  },
});
