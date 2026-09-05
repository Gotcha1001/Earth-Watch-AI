"use client";

// app/dashboard/disaster-news/page.tsx
//
// Tavily scrape -> OpenRouter analyst -> commentary + findings, backed by
// convex/news.ts + convex/newsActions.ts (already built). One button
// generates today's report, one deletes it so it can be re-run.

import { useState } from "react";
import { useDisasterNews } from "@/hooks/useDisasterNews";
import { ScrapingModal } from "@/app/components/ScrapingModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Trash2, Sparkles } from "lucide-react";

type Finding = {
  title: string;
  description?: string;
  location?: string;
  category?: string;
  severity?: "low" | "moderate" | "severe";
  link?: string;
  publishedDate?: string;
};

const SEVERITY_BADGE: Record<string, string> = {
  severe: "bg-red-600",
  moderate: "bg-orange-500",
  low: "bg-yellow-500",
};

const CATEGORY_LABEL: Record<string, string> = {
  earthquake: "🌐 Earthquake",
  wildfire: "🔥 Wildfire",
  flood: "🌊 Flood",
  storm: "🌀 Storm",
  volcano: "🌋 Volcano",
  landslide: "⛰️ Landslide",
  tsunami: "🌊 Tsunami",
  other: "❗ Other",
};

// NEW — replaces the old one-size-fits-all "check your API keys" line.
// A ResourceExhausted/overload message from the OpenRouter call is a
// transient upstream capacity issue, not something the user's keys can fix,
// so telling them to go check their keys for that case just sends them on
// a pointless hunt. Everything else still gets a reasonable, honest hint.
function failureHint(reason?: string): string {
  if (!reason) return "Try again.";
  if (reason === "missing_api_key") {
    return "Missing Tavily or OpenRouter API key — check your environment variables.";
  }
  if (/resourceexhausted|overloaded|rate limit/i.test(reason)) {
    return "The AI provider is temporarily overloaded (this is on their end, not your API key). Try again in a minute.";
  }
  if (reason.startsWith("tavily_error")) {
    return "Tavily search failed. Try again, or check your Tavily API key.";
  }
  if (reason.startsWith("http_")) {
    return "The request failed. Try again.";
  }
  return "Try again.";
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <div className="rounded-lg border p-4 dark:border-cyan-900/30">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Badge className={SEVERITY_BADGE[finding.severity ?? "low"]}>
          {(finding.severity ?? "low").toUpperCase()}
        </Badge>
        {finding.category && (
          <span className="text-xs text-gray-400">
            {CATEGORY_LABEL[finding.category] ?? finding.category}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-white dark:text-white">
        {finding.title}
      </p>
      {finding.description && (
        <p className="mt-1 text-sm text-gray-500">{finding.description}</p>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs text-white">
        {finding.location && <span>📍 {finding.location}</span>}
        {finding.link && (
          <a
            href={finding.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-500 hover:underline"
          >
            Source ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function DisasterNewsPage(): React.JSX.Element {
  const { dateKey, report, isLoading, isGenerating, generate, deleteToday } =
    useDisasterNews();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const findings = (report?.findings ?? []) as Finding[];

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    await deleteToday();
  }

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">
            Daily Briefing
          </h2>
          <p className="text-xs text-gray-400">{dateKey} · UTC</p>
        </div>
        <div className="flex gap-2">
          {report && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={isGenerating}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {confirmingDelete ? "Confirm delete" : "Delete today"}
            </Button>
          )}
          <Button size="sm" onClick={() => generate()} disabled={isGenerating}>
            {report ? (
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isGenerating ? "Generating…" : report ? "Regenerate" : "Generate"}
          </Button>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500">Loading today&apos;s report…</p>
      )}

      {!isLoading && !report && !isGenerating && (
        <p className="text-sm text-gray-500">
          No report yet for today. Hit Generate to scan the last 24 hours for
          catastrophic natural disasters.
        </p>
      )}

      {report?.status === "failed" && (
        <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-300">
          {/* CHANGED — was a hardcoded "Try again, or check your Tavily / OpenRouter
              API keys." for every failure. Now the hint matches the actual reason. */}
          Generation failed{report.reason ? `: ${report.reason}` : "."}{" "}
          {failureHint(report.reason)}
        </div>
      )}

      {report?.status === "complete" && (
        <>
          <div className="rounded-lg border p-4 dark:border-cyan-900/30 dark:bg-cyan-950/10">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-cyan-500">
              Commentary
            </h3>
            <p className="text-sm leading-relaxed text-white dark:text-white">
              {report.commentary}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              Findings ({findings.length})
            </h3>
            {findings.length === 0 && (
              <p className="text-sm text-gray-500">
                Nothing catastrophic reported in the last 24 hours.
              </p>
            )}
            {findings.map((f, i) => (
              <FindingCard key={i} finding={f} />
            ))}
          </div>

          {report.sources?.length > 0 && (
            <details className="text-2xl text-white">
              <summary className="cursor-pointer">
                Raw sources ({report.sources.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {report.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-500 hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <ScrapingModal open={isGenerating} />
    </div>
  );
}
