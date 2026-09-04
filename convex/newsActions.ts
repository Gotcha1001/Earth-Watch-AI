"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

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

interface OpenRouterChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
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

const ANALYST_SYSTEM_PROMPT = `You are a disaster-monitoring analyst producing a daily brief for EarthWatch AI. You're given raw news snippets from the last 24 hours. Identify genuinely reported catastrophic natural disasters (earthquakes, wildfires, floods, storms/cyclones, volcanic eruptions, landslides, tsunamis) — ignore unrelated stories, opinion pieces, and anything that isn't an actual reported event.

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
- Only include events actually described in the source material — never invent one.
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

// Public action — triggered directly by the "Generate" button, so it must
// check auth itself the same way clearAllEvents does.
export const generateDailyReport = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in to generate a report.");

    const dateKey = todayDateKey();

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

      // topic: "news" + days: 1 is Tavily's recency-scoped news search --
      // much tighter for "what happened today" than the generic endpoint
      // jobActions.ts uses for evergreen searches.
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

      const orRes = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouterKey}`,
          },
          body: JSON.stringify({
            model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
            messages: [
              { role: "system", content: ANALYST_SYSTEM_PROMPT },
              {
                role: "user",
                content: `Source snippets:\n\n${snippetsForModel}`,
              },
            ],
          }),
        },
      );

      if (!orRes.ok) {
        await ctx.runMutation(internal.news.markFailed, {
          dateKey,
          reason: `http_${orRes.status}`,
        });
        return;
      }

      const orData = (await orRes.json()) as OpenRouterChatResponse;
      if (orData.error) {
        await ctx.runMutation(internal.news.markFailed, {
          dateKey,
          reason: `openrouter_error: ${orData.error.message ?? "unknown"}`,
        });
        return;
      }

      const rawContent = orData.choices?.[0]?.message?.content?.trim() ?? "";
      if (!rawContent) {
        await ctx.runMutation(internal.news.markFailed, {
          dateKey,
          reason: "structuring_failed",
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

      // Hand off anything severe to its own notification stream (kept
      // separate from convex/alerts.ts's My-Regions alerts by design).
      await ctx.runMutation(
        internal.news.createNotificationsForSevereFindings,
        {
          dateKey,
          findings: structured.findings
            .filter((f) => f.severity === "severe")
            .map(({ title, description, location, category, link }) => ({
              title,
              description,
              location,
              category,
              link,
            })),
        },
      );
    } catch (e) {
      console.error(
        "[newsActions] unhandled exception in generateDailyReport()",
        e,
      );
      await ctx.runMutation(internal.news.markFailed, {
        dateKey,
        reason: "exception",
      });
    }
  },
});
