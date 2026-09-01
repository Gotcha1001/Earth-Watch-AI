// convex/eventsIngest.ts  — node runtime: this is the ONLY export type Convex
// allows in a "use node" file, so ingestAll lives here and the
// mutations/queries it calls live in convex/events.ts instead.
"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { fetchUsgsEarthquakes, type NormalizedEvent } from "../lib/api/usgs";
import { fetchEonetEvents } from "../lib/api/eonet";
import { fetchNoaaAlerts } from "../lib/api/noaa";

const RESOLVE_AFTER_MS = 1000 * 60 * 60 * 48; // auto-resolve stale events after 48h

/** Pulls all three feeds in parallel and upserts them. Never throws on a
 * single feed's failure — a NOAA outage shouldn't block earthquake data. */
export const ingestAll = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log(`[cron] ingestAll started at ${new Date().toISOString()}`);

    const results = await Promise.allSettled([
      fetchUsgsEarthquakes(),
      fetchEonetEvents(),
      fetchNoaaAlerts(),
    ]);

    const events: NormalizedEvent[] = [];
    const sourceNames = ["usgs", "eonet", "noaa"] as const;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        events.push(...result.value);
      } else {
        console.error(
          `[events] ${sourceNames[index]} ingest failed:`,
          result.reason,
        );
      }
    });

    if (events.length > 0) {
      await ctx.runMutation(internal.events.upsertEvents, { events });
    }
    await ctx.runMutation(internal.events.resolveStaleEvents, {
      olderThanMs: RESOLVE_AFTER_MS,
    });

    console.log(`[cron] ingestAll finished — ${events.length} events fetched`);
  },
});
