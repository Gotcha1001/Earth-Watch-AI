// convex/riskEngine.ts
"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { distanceKm } from "../lib/geo";
import { scoreRegion, levelForScore, type RiskLevel } from "../lib/riskScoring";
import { callOpenRouterWithRetry } from "../lib/openrouter"; // NEW

const FALLBACK_SUMMARY =
  "Automated analysis is temporarily unavailable. Nearby monitored events are listed below — use your own judgment and local authority guidance.";

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

/** Re-scores every watched region against currently-active events and, for
 * regions crossing "moderate" or higher, writes an assessment + alert. */
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

      if (level === "moderate" || level === "high" || level === "extreme") {
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
