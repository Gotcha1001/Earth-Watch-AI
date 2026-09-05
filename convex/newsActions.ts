"use node";

import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { callOpenRouterWithRetry } from "../lib/openrouter";
import { searchPlace } from "../lib/geocode"; // NEW
import type { NormalizedEvent } from "../lib/api/usgs"; // NEW

interface TavilyNewsResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

interface TavilySearchResponse {
  results?: TavilyNewsResult[];
  error?: string;
}

interface Finding {
  title: string;
  description?: string;
  location?: string;
  category?: string;
  severity?: "low" | "moderate" | "severe";
  link?: string;
  publishedDate?: string;
}

interface StructuredReport {
  commentary: string;
  findings: Finding[];
}

const ANALYST_SYSTEM_PROMPT = `You are a disaster-monitoring analyst producing a daily brief for EarthWatch AI. You're given raw news snippets from the last 24 hours. Identify genuinely reported catastrophic natural disasters (earthquakes, wildfires, floods, storms/cyclones, volcanic eruptions, landslides, tsunamis) -- ignore unrelated stories, opinion pieces, and anything that isn't an actual reported event.

Respond with ONLY a JSON object, no markdown fences, no commentary outside the JSON:

{
  "commentary": "string -- a 3-5 sentence newsroom-style daily brief in your own words, summarizing the overall picture (what's most severe, any pattern across regions). Write like an analyst narrating the day, not a bullet list.",
  "findings": [
    {
      "title": "string -- short headline for this specific event",
      "description": "string or omit -- 1-2 sentences of detail",
      "location": "string or omit -- country/region/city",
      "category": "string or omit -- earthquake | wildfire | flood | storm | volcano | landslide | tsunami | other",
      "severity": "low | moderate | severe",
      "link": "string or omit -- best source URL",
      "publishedDate": "string or omit"
    }
  ]
}

Rules:
- Only include events actually described in the source material -- never invent one.
- Only include events that occurred, were newly confirmed, or substantially escalated within roughly the last 48 hours. If an article is retrospective, anniversary, or summary coverage of an older disaster (e.g. recapping a months-old earthquake as part of a broader "deadliest disasters" or "year in review" piece), EXCLUDE it, even though the article itself was published today.
- For "publishedDate", give the date the disaster itself occurred (YYYY-MM-DD), not the date the article was published, if the source states or clearly implies it. Omit if genuinely unclear.
- De-duplicate: if multiple snippets cover the same event, merge into one finding.
- Return at most 15 findings, most severe first.
- If nothing catastrophic was reported, return an empty findings array and say so plainly in the commentary.`;

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function isValidStructuredReport(x: unknown): x is StructuredReport {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  if (typeof obj.commentary !== "string") return false;
  if (!Array.isArray(obj.findings)) return false;
  return obj.findings.every(
    (f) =>
      f &&
      typeof f === "object" &&
      typeof (f as Record<string, unknown>).title === "string",
  );
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD", UTC
}

// NEW — maps the LLM's free-text category onto the same category union
// disasterEvents uses. "other" and anything unrecognized are intentionally
// left out: there's no matching tab/color for them, so silently forcing one
// in would be worse than just not plotting that finding.
const CATEGORY_FROM_FINDING: Record<string, NormalizedEvent["category"]> = {
  earthquake: "earthquake",
  wildfire: "wildfire",
  flood: "flood",
  storm: "storm",
  volcano: "volcano",
  landslide: "landslide",
  tsunami: "tsunami",
};

// NEW — approximate numeric severity for a news-sourced finding, since these
// only ever come with the LLM's low/moderate/severe label, not a real metric
// like magnitude. Roughly in line with SEVERITY_SCORE in noaa.ts.
const FINDING_SEVERITY_SCORE: Record<"low" | "moderate" | "severe", number> = {
  low: 25,
  moderate: 55,
  severe: 85,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function parseFindingDate(
  publishedDate: string | undefined,
  fallback: number,
): number {
  if (!publishedDate) return fallback;
  const parsed = Date.parse(publishedDate);
  return Number.isNaN(parsed) ? fallback : parsed;
}

// NEW — the missing link between this pipeline and the map/dashboard.
// Geocodes each moderate-or-worse finding's free-text location via the same
// Nominatim client geocodeBackfill.ts uses (rate-limited to ~1 req/sec, so
// a busy day with several findings can add real seconds to this action —
// worth knowing since this runs on the "Generate" button click).
// Reuses events.upsertEvents so dedup/patch behaves identically to every
// other source: a landslide reported again in tomorrow's scrape updates the
// same row rather than creating a duplicate pin.
async function promoteFindingsToMap(
  ctx: ActionCtx,
  dateKey: string,
  findings: Finding[],
): Promise<void> {
  const eligible = findings.filter(
    (f) =>
      (f.severity === "moderate" || f.severity === "severe") &&
      f.location &&
      f.category &&
      CATEGORY_FROM_FINDING[f.category],
  );
  if (eligible.length === 0) return;

  const events: NormalizedEvent[] = [];
  for (const finding of eligible) {
    try {
      const results = await searchPlace(finding.location!, 1);
      const hit = results[0];
      if (!hit) continue; // couldn't resolve a coordinate -- skip rather than guess one
      events.push({
        externalId: `news-${dateKey}-${slugify(finding.title)}`,
        source: "news",
        category: CATEGORY_FROM_FINDING[finding.category!],
        title: finding.title,
        description: finding.description,
        locationName: finding.location,
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        severity: FINDING_SEVERITY_SCORE[finding.severity!],
        rawSeverityLabel: finding.severity!,
        occurredAt: parseFindingDate(finding.publishedDate, Date.now()),
        sourceUrl: finding.link,
      });
    } catch (error) {
      console.error(
        `[newsActions] geocode failed for finding "${finding.title}":`,
        error,
      );
    }
  }

  if (events.length > 0) {
    await ctx.runMutation(internal.events.upsertEvents, { events });
  }
}

// Cron-triggered runs skip regeneration if today's report is already
// fresh -- keeps the 4-hourly cron from burning a Tavily+OpenRouter call
// every single tick when nothing's changed. An explicit "Regenerate"
// click always bypasses this via force: true.
const REGEN_COOLDOWN_MS = 1000 * 60 * 60 * 3; // 3h -- a bit under the 4h cron interval

async function generateDailyReportCore(
  ctx: ActionCtx,
  force: boolean,
): Promise<void> {
  const dateKey = todayDateKey();

  if (!force) {
    const existing = await ctx.runQuery(api.news.getReport, { dateKey });
    if (
      existing &&
      existing.status === "complete" &&
      Date.now() - existing.generatedAt < REGEN_COOLDOWN_MS
    ) {
      console.log(
        `[newsActions] skipping cron regen -- today's report is ${Math.round((Date.now() - existing.generatedAt) / 60000)}m old`,
      );
      return;
    }
  }

  await ctx.runMutation(internal.news.markGenerating, { dateKey });
  try {
    const tavilyKey = process.env.TAVILY_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!tavilyKey || !openRouterKey) {
      await ctx.runMutation(internal.news.markFailed, {
        dateKey,
        reason: "missing_api_key",
      });
      return;
    }

    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: "catastrophic natural disaster",
        topic: "news",
        days: 1,
        search_depth: "advanced",
        max_results: 20,
      }),
    });

    if (!tavilyRes.ok) {
      await ctx.runMutation(internal.news.markFailed, {
        dateKey,
        reason: `http_${tavilyRes.status}`,
      });
      return;
    }

    const tavilyData = (await tavilyRes.json()) as TavilySearchResponse;
    if (tavilyData.error) {
      await ctx.runMutation(internal.news.markFailed, {
        dateKey,
        reason: `tavily_error: ${tavilyData.error}`,
      });
      return;
    }

    const rawResults = tavilyData.results ?? [];
    if (rawResults.length === 0) {
      // Not a failure -- a genuinely quiet news day is a valid report.
      await ctx.runMutation(internal.news.saveReport, {
        dateKey,
        commentary:
          "No catastrophic natural disasters were reported in the last 24 hours.",
        findings: [],
        sources: [],
      });
      return;
    }

    const snippetsForModel = rawResults
      .slice(0, 20)
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}${r.published_date ? ` (${r.published_date})` : ""}\nURL: ${r.url}\n${r.content.slice(0, 800)}`,
      )
      .join("\n\n");

    let rawContent: string;
    try {
      rawContent = await callOpenRouterWithRetry({
        apiKey: openRouterKey,
        model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        fallbackModel: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: ANALYST_SYSTEM_PROMPT },
          { role: "user", content: `Source snippets:\n\n${snippetsForModel}` },
        ],
      });
    } catch (error) {
      await ctx.runMutation(internal.news.markFailed, {
        dateKey,
        reason: `openrouter_error: ${error instanceof Error ? error.message : "unknown"}`,
      });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(rawContent));
    } catch (e) {
      console.error("[newsActions] failed to parse structured JSON", e);
      await ctx.runMutation(internal.news.markFailed, {
        dateKey,
        reason: "structuring_failed",
      });
      return;
    }

    if (!isValidStructuredReport(parsed)) {
      await ctx.runMutation(internal.news.markFailed, {
        dateKey,
        reason: "structuring_failed",
      });
      return;
    }

    const structured: StructuredReport = parsed;
    const sources = rawResults
      .slice(0, 20)
      .map((r) => ({ title: r.title, url: r.url }));

    await ctx.runMutation(internal.news.saveReport, {
      dateKey,
      commentary: structured.commentary,
      findings: structured.findings.slice(0, 15),
      sources,
    });

    const severeFindings = structured.findings
      .filter((f) => f.severity === "severe")
      .map(
        ({ title, description, location, category, link, publishedDate }) => ({
          title,
          description,
          location,
          category,
          link,
          publishedDate,
        }),
      );

    await ctx.runMutation(internal.news.createNotificationsForSevereFindings, {
      dateKey,
      findings: severeFindings,
    });

    // NEW — the piece that was missing. Runs on ALL moderate-or-worse
    // findings (a wider net than severeFindings above, which is
    // severe-only), so this landslide reaches the map even though it
    // never qualified for a bell notification.
    await promoteFindingsToMap(ctx, dateKey, structured.findings.slice(0, 15));

    // Merged pipeline: don't wait for the 15-min globalPriorityEngine
    // cron to notice a fresh severe finding -- fold it into the global
    // priority decision right away. No-op-ish and cheap if nothing new
    // came in (analyzeGlobalPriority just recomputes off current data).
    if (severeFindings.length > 0) {
      await ctx.runAction(
        internal.globalPriorityEngine.analyzeGlobalPriority,
        {},
      );
    }
  } catch (e) {
    console.error(
      "[newsActions] unhandled exception in generateDailyReportCore()",
      e,
    );
    await ctx.runMutation(internal.news.markFailed, {
      dateKey,
      reason: "exception",
    });
  }
}

// Cron-facing entry point -- no user identity available server-to-server,
// so no auth check here (mirrors eventsIngest.ts's ingestAll).
export const generateDailyReportInternal = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    console.log(
      `[cron] generateDailyReportInternal started at ${new Date().toISOString()} (force=${!!force})`,
    );
    await generateDailyReportCore(ctx, force ?? false);
  },
});

// Public action -- triggered directly by the "Generate"/"Regenerate"
// button, so it checks auth itself the same way clearAllEvents does.
// Always force: true, since a manual click means "I want a fresh one now".
export const generateDailyReport = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in to generate a report.");
    await ctx.runAction(internal.newsActions.generateDailyReportInternal, {
      force: true,
    });
  },
});
