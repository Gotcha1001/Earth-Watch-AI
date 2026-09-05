// lib/priorityScoring.ts
//
// Shared scoring so structured feed events (USGS/EONET/NOAA/GVP) and
// AI-extracted news findings (Tavily -> OpenRouter, via newsActions.ts)
// get folded into one ranked list instead of each pipeline inventing
// its own formula. Mirrors the decay shape of lib/riskScoring.ts's
// per-event weighting, but drops the distance term -- this is a global
// scan, not a per-region proximity alert.

const HALF_LIFE_HOURS = 24; // matches the old GLOBAL_PRIORITY_HALF_LIFE_HOURS

export type PrioritySource = "structured" | "news";

export interface PriorityCandidate {
  id: string;
  source: PrioritySource;
  category: string;
  title: string;
  rawSeverityLabel: string;
  severity: number; // 0-100, same scale disasterEvents.severity already uses
  occurredAt: number; // ms epoch
  latitude?: number;
  longitude?: number;
  locationName?: string;
  link?: string;
}

export function priorityScore(
  candidate: Pick<PriorityCandidate, "severity" | "occurredAt">,
): number {
  const hoursAgo = (Date.now() - candidate.occurredAt) / (1000 * 60 * 60);
  const recencyWeight = Math.pow(0.5, Math.max(0, hoursAgo) / HALF_LIFE_HOURS);
  return candidate.severity * recencyWeight;
}

// Maps newsActions.ts's coarse low/moderate/severe label onto the same
// 0-100 scale structured events use. Pinned toward the top of each band
// -- an LLM-labeled "severe" news report should usually outrank a
// merely-Moderate NOAA alert, not tie with it.
const NEWS_SEVERITY_SCORE: Record<string, number> = {
  severe: 85,
  moderate: 55,
  low: 25,
};

export function newsSeverityToScore(label: string | undefined): number {
  return NEWS_SEVERITY_SCORE[label ?? "low"] ?? 25;
}

export function rankCandidates(
  candidates: PriorityCandidate[],
  topN: number,
): PriorityCandidate[] {
  return [...candidates]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, topN);
}
