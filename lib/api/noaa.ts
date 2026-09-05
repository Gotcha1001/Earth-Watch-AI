// lib/api/noaa.ts

import type { NormalizedEvent } from "./usgs";

interface NoaaAlertProperties {
  id: string;
  event: string; // NEW — e.g. "Tornado Warning", "Tsunami Warning". This is what was missing.
  headline: string | null;
  description: string | null;
  areaDesc?: string | null;
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  effective: string;
  geocode: { SAME?: string[] };
}

interface NoaaGeometry {
  type: string;
  coordinates: number[][][] | number[];
}

interface NoaaFeature {
  id: string;
  properties: NoaaAlertProperties;
  geometry: NoaaGeometry | null;
}

interface NoaaResponse {
  features: NoaaFeature[];
}

const NOAA_ALERTS_URL = "https://api.weather.gov/alerts/active?status=actual";

const SEVERITY_SCORE: Record<NoaaAlertProperties["severity"], number> = {
  Extreme: 95,
  Severe: 75,
  Moderate: 45,
  Minor: 20,
  Unknown: 10,
};

// NWS relays PTWC/NTWC tsunami messages through the same CAP alerts feed as
// tornado/flood warnings — there's no separate tsunami source to add, just
// this event-name check that was missing before.
const TSUNAMI_EVENTS = new Set([
  "Tsunami Warning",
  "Tsunami Advisory",
  "Tsunami Watch",
]);

function categoryForEvent(event: string): NormalizedEvent["category"] {
  return TSUNAMI_EVENTS.has(event) ? "tsunami" : "severeWeather";
}

/** NWS polygons vary a lot in shape; we use the polygon centroid as a stand-in point. */
function centroidOf(
  geometry: NoaaGeometry | null,
): { lat: number; lon: number } | null {
  if (!geometry || geometry.type !== "Polygon") return null;
  const ring = (geometry.coordinates as number[][][])[0];
  if (!ring || ring.length === 0) return null;
  let sumLat = 0;
  let sumLon = 0;
  for (const [lon, lat] of ring) {
    sumLat += lat;
    sumLon += lon;
  }
  return { lat: sumLat / ring.length, lon: sumLon / ring.length };
}

export async function fetchNoaaAlerts(): Promise<NormalizedEvent[]> {
  const response = await fetch(NOAA_ALERTS_URL, {
    headers: { "User-Agent": "EarthWatchAI (contact: ops@earthwatch.ai)" },
  });

  if (!response.ok) {
    throw new Error(`NOAA alerts request failed: ${response.status}`);
  }

  const data = (await response.json()) as NoaaResponse;
  const results: NormalizedEvent[] = [];

  for (const feature of data.features) {
    const point = centroidOf(feature.geometry);
    if (!point) continue; // skip alerts NWS didn't attach a polygon to

    results.push({
      externalId: `noaa-${feature.properties.id}`,
      source: "noaa",
      category: categoryForEvent(feature.properties.event), // CHANGED — was hardcoded "severeWeather"
      title: feature.properties.headline ?? "NWS Alert",
      description: feature.properties.description ?? undefined,
      latitude: point.lat,
      longitude: point.lon,
      severity: SEVERITY_SCORE[feature.properties.severity],
      rawSeverityLabel: feature.properties.severity,
      occurredAt: new Date(feature.properties.effective).getTime(),
      locationName: feature.properties.areaDesc ?? undefined,
    });
  }

  return results;
}
