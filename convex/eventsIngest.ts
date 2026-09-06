// "use node";
// import { action, internalAction } from "./_generated/server";
// import { internal } from "./_generated/api";
// import { fetchUsgsEarthquakes, type NormalizedEvent } from "../lib/api/usgs";
// import { fetchEonetEvents } from "../lib/api/eonet";
// import { fetchNoaaAlerts } from "../lib/api/noaa";
// import { fetchGvpEruptions } from "../lib/api/gvp";

// const RESOLVE_AFTER_MS = 1000 * 60 * 60 * 48; // auto-resolve stale events after 48h

// /** Pulls all three feeds in parallel and upserts them. Never throws on a
//  * single feed's failure — a NOAA outage shouldn't block earthquake data. */
// export const ingestAll = internalAction({
//   args: {},
//   handler: async (ctx) => {
//     console.log(`[cron] ingestAll started at ${new Date().toISOString()}`);
//     const results = await Promise.allSettled([
//       fetchUsgsEarthquakes(),
//       fetchEonetEvents(),
//       fetchNoaaAlerts(),
//       fetchGvpEruptions(),
//     ]);
//     const events: NormalizedEvent[] = [];
//     const sourceNames = ["usgs", "eonet", "noaa", "gvp"] as const;
//     results.forEach((result, index) => {
//       if (result.status === "fulfilled") {
//         events.push(...result.value);
//       } else {
//         console.error(
//           `[events] ${sourceNames[index]} ingest failed:`,
//           result.reason,
//         );
//       }
//     });

//     if (events.length > 0) {
//       await ctx.runMutation(internal.events.upsertEvents, { events });
//     }

//     // Only resolve ended volcanoes when the GVP fetch itself succeeded —
//     // a GVP outage should never be mistaken for "every eruption stopped."
//     const gvpResult = results[3];
//     if (gvpResult.status === "fulfilled") {
//       await ctx.runMutation(internal.events.resolveEndedVolcanoes, {
//         activeExternalIds: gvpResult.value.map((e) => e.externalId),
//       });
//     }

//     await ctx.runMutation(internal.events.resolveStaleEvents, {
//       olderThanMs: RESOLVE_AFTER_MS,
//     });

//     console.log(`[cron] ingestAll finished — ${events.length} events fetched`);
//   },
// });

// export const manualIngest = action({
//   args: {},
//   handler: async (ctx) => {
//     console.log(
//       `[manual] ingestAll triggered manually at ${new Date().toISOString()}`,
//     );
//     await ctx.runAction(internal.eventsIngest.ingestAll, {});
//   },
// });

// convex/eventsIngest.ts
"use node";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { fetchUsgsEarthquakes, type NormalizedEvent } from "../lib/api/usgs";
import { fetchEonetEvents } from "../lib/api/eonet";
import { fetchNoaaAlerts } from "../lib/api/noaa";
// CHANGED — fetchGvpEruptions moved out to volcanoIngest.ts, which runs
// on its own much slower cron. Eruptions don't start/stop every 5
// minutes; there's no reason to hit GVP's server on the same cadence as
// earthquakes and weather.

const RESOLVE_AFTER_MS = 1000 * 60 * 60 * 48; // auto-resolve stale events after 48h

/** Pulls earthquake/EONET/NOAA feeds in parallel and upserts them. Never
 * throws on a single feed's failure — a NOAA outage shouldn't block
 * earthquake data. Volcanoes are handled separately by volcanoIngest.ts. */
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

export const manualIngest = action({
  args: {},
  handler: async (ctx) => {
    console.log(
      `[manual] ingestAll triggered manually at ${new Date().toISOString()}`,
    );
    await ctx.runAction(internal.eventsIngest.ingestAll, {});
  },
});
