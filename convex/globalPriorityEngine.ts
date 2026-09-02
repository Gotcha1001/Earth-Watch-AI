// convex/globalPriorityEngine.ts
"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const GLOBAL_PRIORITY_HALF_LIFE_HOURS = 24; // slower decay than region scoring — this is a global scan, not a proximity alert

const GLOBAL_PRIORITY_PROMPT = `You are EarthWatch AI's global situation desk. You are given a JSON list of the top currently-active disaster events worldwide, already ranked by a severity/recency score. Do three things:
1. Name the single most dangerous event exactly as given in its "title" field.
2. Decide if the current situation is serious enough that people should be proactively notified, not just logged — true or false.
3. Write a 2-4 sentence plain-English summary of the most concerning events.
Respond with ONLY a JSON object, no markdown, no code fences, in exactly this shape:
{"mostDangerousTitle": string, "notifyRecommended": boolean, "summary": string}`;

interface ScoredEvent {
  eventId: Id<"disasterEvents">;
  category: string;
  title: string;
  rawSeverityLabel: string;
  severity: number;
  hoursAgo: number;
  latitude: number; // NEW
  longitude: number; // NEW
  locationName?: string; // NEW
}

async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    },
  );
  if (!response.ok)
    throw new Error(`OpenRouter request failed: ${response.status}`);
  interface OpenRouterResponse {
    choices?: { message?: { content?: string } }[];
  }
  const data = (await response.json()) as OpenRouterResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned no content");
  return text;
}

export const analyzeGlobalPriority = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log(
      `[cron] analyzeGlobalPriority started at ${new Date().toISOString()}`,
    );

    const activeEvents = await ctx.runQuery(
      internal.events.listActiveEventsInternal,
      {},
    );
    if (activeEvents.length === 0) {
      console.log("[cron] analyzeGlobalPriority: no active events, skipping");
      return;
    }

    const now = Date.now();
    const scored: ScoredEvent[] = activeEvents
      .map((event) => {
        const hoursAgo = (now - event.occurredAt) / (1000 * 60 * 60);
        const recencyWeight = Math.pow(
          0.5,
          hoursAgo / GLOBAL_PRIORITY_HALF_LIFE_HOURS,
        );
        return {
          eventId: event._id,
          category: event.category,
          title: event.title,
          rawSeverityLabel: event.rawSeverityLabel,
          severity: event.severity,
          hoursAgo: Math.round(hoursAgo),
          latitude: event.latitude,
          longitude: event.longitude,
          locationName: event.locationName,
          score: event.severity * recencyWeight,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score, ...rest }) => rest);

    const apiKey = process.env.OPENROUTER_API_KEY;
    let mostDangerousTitle = scored[0].title;
    let notifyRecommended = scored[0].severity >= 55; // heuristic fallback, mirrors "high" threshold
    let summary =
      "Automated analysis is temporarily unavailable. Top current events are listed below.";

    if (apiKey) {
      try {
        const raw = await callOpenRouter(
          `${GLOBAL_PRIORITY_PROMPT}\n\nEvents (JSON): ${JSON.stringify(scored)}`,
          apiKey,
        );
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as {
          mostDangerousTitle: string;
          notifyRecommended: boolean;
          summary: string;
        };
        mostDangerousTitle = parsed.mostDangerousTitle;
        notifyRecommended = parsed.notifyRecommended;
        summary = parsed.summary;
      } catch (error) {
        console.error(
          "[globalPriorityEngine] OpenRouter call/parse failed:",
          error,
        );
      }
    } else {
      console.error(
        "[globalPriorityEngine] OPENROUTER_API_KEY missing; using fallback summary.",
      );
    }

    await ctx.runMutation(internal.globalPriority.recordGlobalBriefing, {
      topEvents: scored,
      mostDangerousTitle,
      notifyRecommended,
      aiSummary: summary,
    });

    console.log(
      `[cron] analyzeGlobalPriority finished — notifyRecommended=${notifyRecommended}, top="${mostDangerousTitle}"`,
    );
  },
});
