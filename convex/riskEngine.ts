// // convex/riskEngine.ts
// "use node";
// import { v } from "convex/values";
// import { internalAction } from "./_generated/server";
// import { internal } from "./_generated/api";
// import { distanceKm } from "../lib/geo";
// import { scoreRegion, levelForScore, type RiskLevel } from "../lib/riskScoring";
// import { callOpenRouterWithRetry } from "../lib/openrouter";

// const FALLBACK_SUMMARY =
//   "Automated analysis is temporarily unavailable. Nearby monitored events are listed below — use your own judgment and local authority guidance.";

// const RISK_ANALYST_PROMPT = `You are EarthWatch AI, a calm, precise disaster-risk analyst. You are given a JSON list of real monitored events (earthquakes, wildfires, floods, storms, volcanic activity, severe weather) near ONE specific watched region, each with type, distance in km, how many hours ago it occurred, and severity (0-100).

// Write a short risk summary for the person watching this region:
// 1. State the overall situation in one sentence.
// 2. Name the 1-2 most concerning events specifically (type, distance, how recent).
// 3. Give one concrete, practical recommendation appropriate to the risk level (e.g. "no action needed," "monitor conditions," "review your evacuation route," "consider evacuating now").
// Keep it under 4 sentences, plain text, no markdown, no hedging disclaimers about being an AI.`;

// interface RegionEventInput {
//   category: string;
//   rawSeverityLabel: string;
//   severity: number;
//   distanceKm: number;
//   hoursAgo: number;
// }

// function buildPrompt(regionName: string, events: RegionEventInput[]): string {
//   return `${RISK_ANALYST_PROMPT}\n\nRegion: ${regionName}\nEvents (JSON): ${JSON.stringify(events)}`;
// }

// // CHANGED — was a raw fetch() with no retry, so any transient overload from
// // NVIDIA's free NIM worker pool (the same shared-capacity issue newsActions.ts
// // hit) fell straight through to the catch block below and silently degraded
// // every affected region to FALLBACK_SUMMARY for that whole 20-min cycle.
// // Lighter retry budget than newsActions.ts's default, since this runs once
// // per region in a loop rather than once per report — see note above.
// async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
//   return callOpenRouterWithRetry({
//     apiKey,
//     model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
//     fallbackModel: "openai/gpt-4o-mini", // swap for whatever you settle on
//     messages: [{ role: "user", content: prompt }],
//     maxRetries: 1,
//     retryDelayMs: 800,
//   });
// }

// /** Re-scores every watched region against currently-active events and, for
//  * regions crossing "moderate" or higher, writes an assessment every tick
//  * but ONLY writes a new alert when the risk LEVEL actually changed since
//  * the last assessment for that region.
//  *
//  * Without this check, a region sitting at "high" for three days because
//  * one wildfire keeps burning would generate a brand new alert row every
//  * single 20-minute tick — ~216 duplicate alerts for one ongoing situation
//  * the user already saw. Now: assessments still update every tick (so the
//  * dashboard's "latest assessment" summary stays fresh), but the alerts
//  * table — and therefore anything that notifies the user — only grows when
//  * something actually changed. */
// export const analyzeAllRegions = internalAction({
//   args: {},
//   handler: async (ctx) => {
//     const regions = await ctx.runQuery(internal.regions.listAllRegions, {});
//     const activeEvents = await ctx.runQuery(
//       internal.events.listActiveEventsInternal,
//       {},
//     );
//     const apiKey = process.env.OPENROUTER_API_KEY;

//     for (const region of regions) {
//       const now = Date.now();
//       const nearby = activeEvents
//         .map((event) => ({
//           event,
//           distance: distanceKm(region, event),
//         }))
//         .filter(({ distance }) => distance <= Math.max(region.radiusKm, 100))
//         .sort((a, b) => a.distance - b.distance)
//         .slice(0, 8);

//       if (nearby.length === 0) continue;

//       const score = scoreRegion(
//         nearby.map(({ event, distance }) => ({
//           severity: event.severity,
//           occurredAt: event.occurredAt,
//           distanceKm: distance,
//         })),
//       );
//       const level: RiskLevel = levelForScore(score);
//       if (level === "low") continue; // don't spam assessments for negligible risk

//       const eventInputs: RegionEventInput[] = nearby.map(
//         ({ event, distance }) => ({
//           category: event.category,
//           rawSeverityLabel: event.rawSeverityLabel,
//           severity: event.severity,
//           distanceKm: Math.round(distance),
//           hoursAgo: Math.round((now - event.occurredAt) / (1000 * 60 * 60)),
//         }),
//       );

//       let summary = FALLBACK_SUMMARY;
//       if (apiKey) {
//         try {
//           summary = await callOpenRouter(
//             buildPrompt(region.name, eventInputs),
//             apiKey,
//           );
//         } catch (error) {
//           console.error(
//             "[riskEngine] OpenRouter call failed:",
//             region._id,
//             error,
//           );
//         }
//       } else {
//         console.error(
//           "[riskEngine] OPENROUTER_API_KEY missing; using fallback summary.",
//         );
//       }

//       // NEW — look up the region's last assessment BEFORE recording this
//       // one, so we can tell whether the level actually changed.
//       const previous = await ctx.runQuery(
//         internal.riskAssessments.getLatestForRegionInternal,
//         { regionId: region._id },
//       );
//       const levelChanged = !previous || previous.riskLevel !== level;

//       const assessmentId = await ctx.runMutation(
//         internal.riskAssessments.recordAssessment,
//         {
//           regionId: region._id,
//           riskScore: score,
//           riskLevel: level,
//           contributingEventIds: nearby.map(({ event }) => event._id),
//           aiSummary: summary,
//         },
//       );

//       // CHANGED — only fires when the level actually moved (e.g.
//       // moderate -> high, or high -> extreme, or dropping back down and
//       // later climbing again). A region parked at the same level tick
//       // after tick no longer spawns a fresh alert every 20 minutes.
//       if (
//         levelChanged &&
//         (level === "moderate" || level === "high" || level === "extreme")
//       ) {
//         await ctx.runMutation(internal.alerts.createAlertForRegion, {
//           userId: region.userId,
//           regionId: region._id,
//           assessmentId,
//           riskLevel: level,
//           message: summary,
//         });
//       }
//     }
//   },
// });
// convex/riskEngine.ts
"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { distanceKm } from "../lib/geo";
import { scoreRegion, levelForScore, type RiskLevel } from "../lib/riskScoring";
import { callOpenRouterWithRetry } from "../lib/openrouter";

const FALLBACK_SUMMARY =
  "Automated analysis is temporarily unavailable. Nearby monitored events are listed below — use your own judgment and local authority guidance.";

// How much the 0-100 score has to move, even within the same risk level,
// before we treat it as "actually changed" and worth a fresh AI summary +
// assessment row. A region sitting at score 61 vs 63 tick-to-tick is just
// recency/proximity decay noise, not a meaningful shift the user needs to
// re-read a summary about.
const SCORE_CHANGE_THRESHOLD = 8;

const RISK_ANALYST_PROMPT = `You are EarthWatch AI, a calm, precise disaster-risk analyst. You are given a JSON list of real monitored events (earthquakes, wildfires, floods, storms, volcanic activity, severe weather) near ONE specific watched region, each with type, distance in km, how many hours ago it occurred, and severity (0-100).

Write a short risk summary for the person watching this region:
1. State the overall situation in one sentence.
2. Name the 1-2 most concerning events specifically (type, distance, how recent).
3. Give one concrete, practical recommendation appropriate to the risk level (e.g. "no action needed," "monitor conditions," "review your evacuation route," "consider evacuating now").
Keep it under 4 sentences, plain text, no markdown, no hedging disclaimers about being an AI.`;

interface RegionEventInput {
  category: string;
  rawSeverityLabel: string;
  severity: number;
  distanceKm: number;
  hoursAgo: number;
}

function buildPrompt(regionName: string, events: RegionEventInput[]): string {
  return `${RISK_ANALYST_PROMPT}\n\nRegion: ${regionName}\nEvents (JSON): ${JSON.stringify(events)}`;
}

// CHANGED — was a raw fetch() with no retry, so any transient overload from
// NVIDIA's free NIM worker pool (the same shared-capacity issue newsActions.ts
// hit) fell straight through to the catch block below and silently degraded
// every affected region to FALLBACK_SUMMARY for that whole 20-min cycle.
// Lighter retry budget than newsActions.ts's default, since this runs once
// per region in a loop rather than once per report — see note above.
async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  return callOpenRouterWithRetry({
    apiKey,
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    fallbackModel: "openai/gpt-4o-mini", // swap for whatever you settle on
    messages: [{ role: "user", content: prompt }],
    maxRetries: 1,
    retryDelayMs: 800,
  });
}

/** Re-scores every watched region against currently-active events. For
 * regions at "moderate" or higher, only does real work — AI summary,
 * new riskAssessments row, and (on a level change) a new alert — when
 * the situation has actually moved since the last assessment. A region
 * parked at the same level and roughly the same score tick after tick
 * now costs one query and nothing else, instead of an OpenRouter call
 * and two new database rows every 20 minutes. */
export const analyzeAllRegions = internalAction({
  args: {},
  handler: async (ctx) => {
    const regions = await ctx.runQuery(internal.regions.listAllRegions, {});
    const activeEvents = await ctx.runQuery(
      internal.events.listActiveEventsInternal,
      {},
    );
    const apiKey = process.env.OPENROUTER_API_KEY;

    for (const region of regions) {
      const now = Date.now();
      const nearby = activeEvents
        .map((event) => ({
          event,
          distance: distanceKm(region, event),
        }))
        .filter(({ distance }) => distance <= Math.max(region.radiusKm, 100))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 8);

      if (nearby.length === 0) continue;

      const score = scoreRegion(
        nearby.map(({ event, distance }) => ({
          severity: event.severity,
          occurredAt: event.occurredAt,
          distanceKm: distance,
        })),
      );
      const level: RiskLevel = levelForScore(score);
      if (level === "low") continue; // don't spam assessments for negligible risk

      // NEW — look this up BEFORE doing any AI call or writing anything,
      // so a no-change tick costs nothing beyond this one query.
      const previous = await ctx.runQuery(
        internal.riskAssessments.getLatestForRegionInternal,
        { regionId: region._id },
      );
      const levelChanged = !previous || previous.riskLevel !== level;
      const scoreChanged =
        !previous ||
        Math.abs(previous.riskScore - score) >= SCORE_CHANGE_THRESHOLD;
      const meaningfullyChanged = levelChanged || scoreChanged;

      if (!meaningfullyChanged) {
        // Nothing worth recording — same level, score within noise range
        // of the last assessment. Skip the AI call and both inserts.
        continue;
      }

      const eventInputs: RegionEventInput[] = nearby.map(
        ({ event, distance }) => ({
          category: event.category,
          rawSeverityLabel: event.rawSeverityLabel,
          severity: event.severity,
          distanceKm: Math.round(distance),
          hoursAgo: Math.round((now - event.occurredAt) / (1000 * 60 * 60)),
        }),
      );

      let summary = FALLBACK_SUMMARY;
      if (apiKey) {
        try {
          summary = await callOpenRouter(
            buildPrompt(region.name, eventInputs),
            apiKey,
          );
        } catch (error) {
          console.error(
            "[riskEngine] OpenRouter call failed:",
            region._id,
            error,
          );
        }
      } else {
        console.error(
          "[riskEngine] OPENROUTER_API_KEY missing; using fallback summary.",
        );
      }

      const assessmentId = await ctx.runMutation(
        internal.riskAssessments.recordAssessment,
        {
          regionId: region._id,
          riskScore: score,
          riskLevel: level,
          contributingEventIds: nearby.map(({ event }) => event._id),
          aiSummary: summary,
        },
      );

      // Alerts still only fire on an actual level change, not just a
      // score wobble within the same level — a jump from score 60 to 70
      // is worth a fresh assessment/summary, but it's still "high" either
      // way, so it doesn't need to re-notify the user with a new alert.
      if (
        levelChanged &&
        (level === "moderate" || level === "high" || level === "extreme")
      ) {
        await ctx.runMutation(internal.alerts.createAlertForRegion, {
          userId: region.userId,
          regionId: region._id,
          assessmentId,
          riskLevel: level,
          message: summary,
        });
      }
    }
  },
});
