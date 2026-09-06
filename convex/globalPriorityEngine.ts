// // convex/globalPriorityEngine.ts
// //
// // Single decision point for "should we proactively notify people right
// // now" -- merges structured feed events (disasterEvents, via USGS/EONET/
// // NOAA/GVP) and AI-extracted severe news findings (briefingNotifications,
// // via Tavily -> OpenRouter in newsActions.ts) into one ranked list before
// // asking the LLM to name the top threat and decide notifyRecommended.
// // Previously these were two independent severity opinions written to two
// // different tables; this is now the one place that decides.
// "use node";

// import { internalAction } from "./_generated/server";
// import { internal } from "./_generated/api";
// import {
//   priorityScore,
//   newsSeverityToScore,
//   type PriorityCandidate,
// } from "../lib/priorityScoring";

// const GLOBAL_PRIORITY_PROMPT = `You are EarthWatch AI's global situation desk. You are given a JSON list of the top currently-active disaster signals worldwide -- some from structured sensor/agency feeds (USGS/EONET/NOAA/GVP), some extracted by another AI pass from breaking news coverage -- already ranked by a severity/recency score. Do three things:

// 1. Name the single most dangerous event exactly as given in its "title" field.
// 2. Decide if the current situation is serious enough that people should be proactively notified, not just logged -- true or false.
// 3. Write a 2-4 sentence plain-English summary of the most concerning events. If multiple entries clearly describe the same real-world event (e.g. a structured feed hit and a news hit for the same earthquake), mention it once, not twice.

// Respond with ONLY a JSON object, no markdown, no code fences, in exactly this shape:

// {"mostDangerousTitle": string, "notifyRecommended": boolean, "summary": string}`;

// async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
//   const response = await fetch(
//     "https://openrouter.ai/api/v1/chat/completions",
//     {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${apiKey}`,
//       },
//       body: JSON.stringify({
//         model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
//         messages: [{ role: "user", content: prompt }],
//         stream: false,
//       }),
//     },
//   );
//   if (!response.ok)
//     throw new Error(`OpenRouter request failed: ${response.status}`);
//   interface OpenRouterResponse {
//     choices?: { message?: { content?: string } }[];
//   }
//   const data = (await response.json()) as OpenRouterResponse;
//   const text = data.choices?.[0]?.message?.content?.trim();
//   if (!text) throw new Error("OpenRouter returned no content");
//   return text;
// }

// export const analyzeGlobalPriority = internalAction({
//   args: {},
//   handler: async (ctx) => {
//     console.log(
//       `[cron] analyzeGlobalPriority started at ${new Date().toISOString()}`,
//     );

//     const [structuredEvents, newsFindings] = await Promise.all([
//       ctx.runQuery(internal.events.listActiveEventsInternal, {}),
//       ctx.runQuery(internal.news.listRecentSevereFindingsInternal, {}),
//     ]);

//     const structuredCandidates: PriorityCandidate[] = structuredEvents.map(
//       (event) => ({
//         id: event._id,
//         source: "structured",
//         category: event.category,
//         title: event.title,
//         rawSeverityLabel: event.rawSeverityLabel,
//         severity: event.severity,
//         occurredAt: event.occurredAt,
//         latitude: event.latitude,
//         longitude: event.longitude,
//         locationName: event.locationName,
//       }),
//     );

//     // createNotificationsForSevereFindings only ever inserts findings the
//     // newsActions.ts LLM pass already labeled "severe", so every row here
//     // is fair game at a fixed high score -- there's no per-item severity
//     // stored on briefingNotifications itself.
//     //
//     // occurredAt prefers the disaster's own publishedDate (when the LLM
//     // supplied one) over createdAt (when we happened to detect it) --
//     // otherwise a months-old earthquake picked up by a retrospective news
//     // article scores as "0h ago" and drowns out everything else. Falls
//     // back to createdAt if publishedDate is missing, unparseable, or in
//     // the future (a hallucinated/garbled date shouldn't score as fresher
//     // than "just detected").
//     const newsCandidates: PriorityCandidate[] = newsFindings.map((finding) => {
//       const parsed = finding.publishedDate
//         ? Date.parse(finding.publishedDate)
//         : NaN;
//       const occurredAt =
//         !Number.isNaN(parsed) && parsed <= Date.now()
//           ? parsed
//           : finding.createdAt;
//       return {
//         id: finding._id,
//         source: "news",
//         category: finding.category ?? "other",
//         title: finding.title,
//         rawSeverityLabel: "Severe (news report)",
//         severity: newsSeverityToScore("severe"),
//         occurredAt,
//         locationName: finding.location,
//         link: finding.link,
//       };
//     });

//     const allCandidates = [...structuredCandidates, ...newsCandidates];

//     if (allCandidates.length === 0) {
//       console.log("[cron] analyzeGlobalPriority: no active signals, skipping");
//       return;
//     }

//     const now = Date.now();
//     const scored = allCandidates
//       .map((c) => ({ ...c, score: priorityScore(c) }))
//       .sort((a, b) => b.score - a.score)
//       .slice(0, 6)
//       .map(({ score, id, occurredAt, ...rest }) => ({
//         sourceId: id,
//         ...rest,
//         hoursAgo: Math.round((now - occurredAt) / (1000 * 60 * 60)),
//       }));

//     const apiKey = process.env.OPENROUTER_API_KEY;
//     let mostDangerousTitle = scored[0].title;
//     let notifyRecommended = scored[0].severity >= 55; // heuristic fallback, mirrors "high" threshold
//     let summary =
//       "Automated analysis is temporarily unavailable. Top current signals are listed below.";

//     if (apiKey) {
//       try {
//         const raw = await callOpenRouter(
//           `${GLOBAL_PRIORITY_PROMPT}\n\nSignals (JSON): ${JSON.stringify(scored)}`,
//           apiKey,
//         );
//         const cleaned = raw.replace(/```json|```/g, "").trim();
//         const parsed = JSON.parse(cleaned) as {
//           mostDangerousTitle: string;
//           notifyRecommended: boolean;
//           summary: string;
//         };
//         mostDangerousTitle = parsed.mostDangerousTitle;
//         notifyRecommended = parsed.notifyRecommended;
//         summary = parsed.summary;
//       } catch (error) {
//         console.error(
//           "[globalPriorityEngine] OpenRouter call/parse failed:",
//           error,
//         );
//       }
//     } else {
//       console.error(
//         "[globalPriorityEngine] OPENROUTER_API_KEY missing; using fallback summary.",
//       );
//     }

//     await ctx.runMutation(internal.globalPriority.recordGlobalBriefing, {
//       topEvents: scored,
//       mostDangerousTitle,
//       notifyRecommended,
//       aiSummary: summary,
//     });

//     console.log(
//       `[cron] analyzeGlobalPriority finished -- notifyRecommended=${notifyRecommended}, top="${mostDangerousTitle}" (${scored[0].source})`,
//     );
//   },
// });
// convex/globalPriorityEngine.ts
//
// Single decision point for "should we proactively notify people right
// now" -- merges structured feed events (disasterEvents, via USGS/EONET/
// NOAA/GVP) and AI-extracted severe news findings (briefingNotifications,
// via Tavily -> OpenRouter in newsActions.ts) into one ranked list before
// asking the LLM to name the top threat and decide notifyRecommended.
"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  priorityScore,
  newsSeverityToScore,
  type PriorityCandidate,
} from "../lib/priorityScoring";

const GLOBAL_PRIORITY_PROMPT = `You are EarthWatch AI's global situation desk. You are given a JSON list of the top currently-active disaster signals worldwide -- some from structured sensor/agency feeds (USGS/EONET/NOAA/GVP), some extracted by another AI pass from breaking news coverage -- already ranked by a severity/recency score. Do three things:
1. Name the single most dangerous event exactly as given in its "title" field.
2. Decide if the current situation is serious enough that people should be proactively notified, not just logged -- true or false.
3. Write a 2-4 sentence plain-English summary of the most concerning events. If multiple entries clearly describe the same real-world event (e.g. a structured feed hit and a news hit for the same earthquake), mention it once, not twice.
Respond with ONLY a JSON object, no markdown, no code fences, in exactly this shape:
{"mostDangerousTitle": string, "notifyRecommended": boolean, "summary": string}`;

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
    const [structuredEvents, newsFindings] = await Promise.all([
      ctx.runQuery(internal.events.listActiveEventsInternal, {}),
      ctx.runQuery(internal.news.listRecentSevereFindingsInternal, {}),
    ]);

    const structuredCandidates: PriorityCandidate[] = structuredEvents.map(
      (event) => ({
        id: event._id,
        source: "structured",
        category: event.category,
        title: event.title,
        rawSeverityLabel: event.rawSeverityLabel,
        severity: event.severity,
        occurredAt: event.occurredAt,
        latitude: event.latitude,
        longitude: event.longitude,
        locationName: event.locationName,
      }),
    );

    const newsCandidates: PriorityCandidate[] = newsFindings.map((finding) => {
      const parsed = finding.publishedDate
        ? Date.parse(finding.publishedDate)
        : NaN;
      const occurredAt =
        !Number.isNaN(parsed) && parsed <= Date.now()
          ? parsed
          : finding.createdAt;
      return {
        id: finding._id,
        source: "news",
        category: finding.category ?? "other",
        title: finding.title,
        rawSeverityLabel: "Severe (news report)",
        severity: newsSeverityToScore("severe"),
        occurredAt,
        locationName: finding.location,
        link: finding.link,
      };
    });

    const allCandidates = [...structuredCandidates, ...newsCandidates];
    if (allCandidates.length === 0) {
      console.log("[cron] analyzeGlobalPriority: no active signals, skipping");
      return;
    }

    const now = Date.now();
    const scored = allCandidates
      .map((c) => ({ ...c, score: priorityScore(c) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ score, id, occurredAt, ...rest }) => ({
        sourceId: id,
        ...rest,
        hoursAgo: Math.round((now - occurredAt) / (1000 * 60 * 60)),
      }));

    // NEW — cheap heuristic values, computed with zero API calls. These are
    // exactly what the code already fell back to when OpenRouter failed, so
    // reusing them as a pre-check costs nothing new to compute.
    const heuristicTitle = scored[0].title;
    const heuristicNotify = scored[0].severity >= 55;

    // NEW — compare against the last STORED briefing before spending an
    // OpenRouter call. If the heuristic view of "what's most dangerous" and
    // "should we notify" hasn't moved since last tick, the AI's actual
    // answer is essentially guaranteed to land in the same place too — so
    // skip the call entirely instead of paying for it just to get told
    // "nothing changed" a few hundred milliseconds later.
    const latest = await ctx.runQuery(
      internal.globalPriority.getLatestGlobalBriefingInternal,
      {},
    );
    const likelyUnchanged =
      latest &&
      latest.mostDangerousTitle === heuristicTitle &&
      latest.notifyRecommended === heuristicNotify;

    if (likelyUnchanged) {
      console.log(
        `[cron] analyzeGlobalPriority: heuristic unchanged ("${heuristicTitle}", notify=${heuristicNotify}) — skipping OpenRouter call`,
      );
      return;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    let mostDangerousTitle = heuristicTitle;
    let notifyRecommended = heuristicNotify;
    let summary =
      "Automated analysis is temporarily unavailable. Top current signals are listed below.";

    if (apiKey) {
      try {
        const raw = await callOpenRouter(
          `${GLOBAL_PRIORITY_PROMPT}\n\nSignals (JSON): ${JSON.stringify(scored)}`,
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

    // recordGlobalBriefing (globalPriority.ts) still does its own
    // title/notify comparison before inserting — kept as a second,
    // independent safety net in case the AI's actual answer diverges
    // from the heuristic that got us past the check above.
    await ctx.runMutation(internal.globalPriority.recordGlobalBriefing, {
      topEvents: scored,
      mostDangerousTitle,
      notifyRecommended,
      aiSummary: summary,
    });
    console.log(
      `[cron] analyzeGlobalPriority finished -- notifyRecommended=${notifyRecommended}, top="${mostDangerousTitle}" (${scored[0].source})`,
    );
  },
});
