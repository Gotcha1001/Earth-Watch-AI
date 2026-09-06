// convex/volcanoIngest.ts
"use node";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { fetchGvpEruptions } from "../lib/api/gvp";

/** Volcano-specific ingest, deliberately separate from ingestAll and on a
 * far slower cron (see crons.ts). GVP's "continuing eruption" registry
 * changes on the order of days/weeks, not minutes — polling it every 5
 * minutes like earthquakes just re-fetches and re-patches the same ~40-50
 * rows over and over for no reason. */
export const ingestVolcanoes = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log(
      `[cron] ingestVolcanoes started at ${new Date().toISOString()}`,
    );
    try {
      const eruptions = await fetchGvpEruptions();
      if (eruptions.length > 0) {
        await ctx.runMutation(internal.events.upsertEvents, {
          events: eruptions,
        });
      }
      // Only resolve ended volcanoes when the fetch itself succeeded — a
      // GVP outage should never be mistaken for "every eruption stopped."
      await ctx.runMutation(internal.events.resolveEndedVolcanoes, {
        activeExternalIds: eruptions.map((e) => e.externalId),
      });
      console.log(
        `[cron] ingestVolcanoes finished — ${eruptions.length} continuing eruptions`,
      );
    } catch (error) {
      console.error("[volcanoIngest] GVP fetch failed:", error);
    }
  },
});

// Manual trigger — e.g. for a "Refresh volcanoes" button on the
// Volcanoes page, independent of the main dashboard's "Reset" button
// (which now only re-triggers earthquake/EONET/NOAA, not volcanoes).
export const manualIngestVolcanoes = action({
  args: {},
  handler: async (ctx) => {
    console.log(
      `[manual] ingestVolcanoes triggered manually at ${new Date().toISOString()}`,
    );
    await ctx.runAction(internal.volcanoIngest.ingestVolcanoes, {});
  },
});
