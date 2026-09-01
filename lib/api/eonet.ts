// lib/api/eonet.ts
import type { NormalizedEvent } from "./usgs";

interface EonetCategory {
  id: string;
  title: string;
}

interface EonetGeometry {
  date: string;
  type: "Point" | "Polygon";
  coordinates: number[] | number[][][];
}

interface EonetEvent {
  id: string;
  title: string;
  description?: string;
  link: string;
  categories: EonetCategory[];
  geometry: EonetGeometry[];
  closed?: string | null;
}

interface EonetResponse {
  events: EonetEvent[];
}

const EONET_URL =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100";

const CATEGORY_MAP: Record<string, NormalizedEvent["category"]> = {
  wildfires: "wildfire",
  floods: "flood",
  severeStorms: "storm",
  volcanoes: "volcano",
  drought: "severeWeather",
  snow: "severeWeather",
};

// EONET doesn't give a numeric severity, so we approximate from category —
// this is intentionally coarse; the AI risk-summary step reads the raw
// title/description too, not just this number.
const CATEGORY_BASE_SEVERITY: Record<NormalizedEvent["category"], number> = {
  earthquake: 0,
  wildfire: 55,
  flood: 60,
  storm: 65,
  volcano: 70,
  severeWeather: 40,
};

function firstPoint(
  geometry: EonetGeometry,
): { lat: number; lon: number } | null {
  if (geometry.type !== "Point") return null;
  const [lon, lat] = geometry.coordinates as number[];
  return { lat, lon };
}

export async function fetchEonetEvents(): Promise<NormalizedEvent[]> {
  const response = await fetch(EONET_URL);
  if (!response.ok) {
    throw new Error(`EONET request failed: ${response.status}`);
  }
  const data = (await response.json()) as EonetResponse;

  const results: NormalizedEvent[] = [];
  for (const event of data.events) {
    const categoryId = event.categories[0]?.id ?? "";
    const category = CATEGORY_MAP[categoryId];
    if (!category) continue; // skip categories we don't track (e.g. dust/haze)

    const latestGeometry = event.geometry[event.geometry.length - 1];
    const point = firstPoint(latestGeometry);
    if (!point) continue; // skip polygon-only events for now

    results.push({
      externalId: `eonet-${event.id}`,
      source: "eonet",
      category,
      title: event.title,
      description: event.description ?? undefined, // was: event.description
      latitude: point.lat,
      longitude: point.lon,
      severity: CATEGORY_BASE_SEVERITY[category],
      rawSeverityLabel: event.categories[0]?.title ?? "Unclassified",
      occurredAt: new Date(latestGeometry.date).getTime(),
      sourceUrl: event.link,
    });
  }
  return results;
}
