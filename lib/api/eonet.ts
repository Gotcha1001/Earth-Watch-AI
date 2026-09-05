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

const EONET_BASE = "https://eonet.gsfc.nasa.gov/api/v3/events";

const CATEGORY_MAP: Record<string, NormalizedEvent["category"]> = {
  wildfires: "wildfire",
  floods: "flood",
  severeStorms: "storm",
  volcanoes: "volcano",
  drought: "severeWeather",
  snow: "severeWeather",
  landslides: "landslide", // rockslides, snow/ice avalanches — the trigger
  // behind events like the Nepal/Sikkim glacial lake outburst flood
  seaLakeIce: "iceberg", // large-scale ice-shelf/glacier calving events
};

// Base severity per our category, used since EONET has no numeric severity.
const CATEGORY_BASE_SEVERITY: Record<NormalizedEvent["category"], number> = {
  earthquake: 0,
  wildfire: 55,
  flood: 60,
  storm: 65,
  volcano: 70,
  severeWeather: 40,
  // Landslides/ice avalanches escalate fast and are exactly what precedes
  // a GLOF or a fjord tsunami — weighted above wildfire/flood defaults.
  landslide: 65,
  // Calving itself is rarely an immediate life-safety event (shipping/
  // coastal-erosion relevance mostly) — kept lower than landslide.
  iceberg: 40,
  tsunami: 95,
};

// One request per EONET category id, each with its own limit, so a busy
// category (wildfires, severeStorms) can never crowd a quieter one
// (volcanoes) out of the results the way a single shared limit did.
const CATEGORY_FETCH_LIMITS: Record<string, number> = {
  wildfires: 100,
  floods: 50,
  severeStorms: 50,
  volcanoes: 50,
  drought: 25,
  snow: 25,
  landslides: 50,
  seaLakeIce: 25,
};

function firstPoint(
  geometry: EonetGeometry,
): { lat: number; lon: number } | null {
  if (geometry.type !== "Point") return null;
  const [lon, lat] = geometry.coordinates as number[];
  return { lat, lon };
}

async function fetchEonetCategory(
  categoryId: string,
  limit: number,
): Promise<EonetEvent[]> {
  const url = `${EONET_BASE}?status=open&category=${categoryId}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `EONET request failed for category=${categoryId}: ${response.status}`,
    );
  }
  const data = (await response.json()) as EonetResponse;
  return data.events;
}

export async function fetchEonetEvents(): Promise<NormalizedEvent[]> {
  const categoryIds = Object.keys(CATEGORY_FETCH_LIMITS);

  const results = await Promise.allSettled(
    categoryIds.map((id) => fetchEonetCategory(id, CATEGORY_FETCH_LIMITS[id])),
  );

  const rawEvents: EonetEvent[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      rawEvents.push(...result.value);
    } else {
      // One category failing (e.g. EONET hiccup on "volcanoes") should
      // never cost us the other categories in the same ingest tick.
      console.error(
        `[eonet] category "${categoryIds[index]}" fetch failed:`,
        result.reason,
      );
    }
  });

  // Same event can theoretically show up if EONET tags it with more than
  // one of the categories we queried — dedupe by EONET's own id.
  const seen = new Set<string>();
  const normalized: NormalizedEvent[] = [];

  for (const event of rawEvents) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);

    const categoryId = event.categories[0]?.id ?? "";
    const category = CATEGORY_MAP[categoryId];
    if (!category) continue; // skip categories we don't track (e.g. dust/haze)

    const latestGeometry = event.geometry[event.geometry.length - 1];
    const point = firstPoint(latestGeometry);
    if (!point) continue; // skip polygon-only events for now

    normalized.push({
      externalId: `eonet-${event.id}`,
      source: "eonet",
      category,
      title: event.title,
      description: event.description ?? undefined,
      locationName: event.title,
      latitude: point.lat,
      longitude: point.lon,
      severity: CATEGORY_BASE_SEVERITY[category],
      rawSeverityLabel: event.categories[0]?.title ?? "Unclassified",
      occurredAt: new Date(latestGeometry.date).getTime(),
      sourceUrl: event.link,
    });
  }

  return normalized;
}
