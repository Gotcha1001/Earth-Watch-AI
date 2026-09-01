// lib/riskScoring.ts
export type RiskLevel = "low" | "moderate" | "high" | "extreme";

export interface ScorableEvent {
  severity: number; // 0-100, already normalized at ingest
  occurredAt: number; // ms epoch
  distanceKm: number;
}

const RECENCY_HALF_LIFE_HOURS = 12;
const PROXIMITY_FALLOFF_KM = 150;

/**
 * Combines severity, recency and proximity into one 0-100 score per event,
 * then folds the whole list into a single region-level score.
 * Recency and proximity both decay exponentially so a severe-but-old or
 * severe-but-far event contributes less than a fresh, close one.
 */
export function scoreRegion(events: ScorableEvent[]): number {
  if (events.length === 0) return 0;

  const now = Date.now();
  const weighted = events.map((event) => {
    const ageHours = (now - event.occurredAt) / (1000 * 60 * 60);
    const recencyWeight = Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);
    const proximityWeight = Math.exp(
      -event.distanceKm / PROXIMITY_FALLOFF_KM,
    );
    return event.severity * recencyWeight * proximityWeight;
  });

  // Diminishing-returns combination: multiple simultaneous signals raise
  // risk faster than a single event would, but never trivially exceed 100.
  const combined =
    100 * (1 - weighted.reduce((acc, w) => acc * (1 - w / 100), 1));

  return Math.round(Math.min(100, Math.max(0, combined)));
}

export function levelForScore(score: number): RiskLevel {
  if (score >= 80) return "extreme";
  if (score >= 55) return "high";
  if (score >= 25) return "moderate";
  return "low";
}