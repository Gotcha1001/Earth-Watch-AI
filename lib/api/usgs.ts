// lib/api/usgs.ts
export interface NormalizedEvent {
  externalId: string;
  source: "usgs" | "eonet" | "noaa" | "gvp";
  category:
    | "earthquake"
    | "wildfire"
    | "flood"
    | "storm"
    | "volcano"
    | "severeWeather"
    | "landslide"
    | "iceberg";

  title: string;
  description?: string;
  locationName?: string; // add
  latitude: number;
  longitude: number;
  severity: number;
  rawSeverityLabel: string;
  occurredAt: number;
  sourceUrl?: string;
}

interface UsgsFeatureProperties {
  mag: number | null;
  place: string | null;
  time: number;
  url: string;
  title: string;
}

interface UsgsFeatureGeometry {
  coordinates: [number, number, number]; // lon, lat, depth
}

interface UsgsFeature {
  id: string;
  properties: UsgsFeatureProperties;
  geometry: UsgsFeatureGeometry;
}

interface UsgsFeedResponse {
  features: UsgsFeature[];
}

const USGS_FEED_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson";

/** Maps USGS magnitude (typically 0-9) onto our 0-100 severity scale. */
function magnitudeToSeverity(magnitude: number | null): number {
  if (magnitude === null) return 0;
  return Math.round(Math.min(100, Math.max(0, (magnitude / 9) * 100)));
}

export async function fetchUsgsEarthquakes(): Promise<NormalizedEvent[]> {
  const response = await fetch(USGS_FEED_URL);
  if (!response.ok) {
    throw new Error(`USGS feed request failed: ${response.status}`);
  }
  const data = (await response.json()) as UsgsFeedResponse;

  return data.features.map((feature): NormalizedEvent => {
    const [longitude, latitude] = feature.geometry.coordinates;
    return {
      externalId: `usgs-${feature.id}`,
      source: "usgs",
      category: "earthquake",
      title: feature.properties.title,
      description: feature.properties.place ?? undefined,
      locationName: feature.properties.place ?? undefined,
      latitude,
      longitude,
      severity: magnitudeToSeverity(feature.properties.mag),
      rawSeverityLabel:
        feature.properties.mag !== null
          ? `M ${feature.properties.mag.toFixed(1)}`
          : "Unknown magnitude",
      occurredAt: feature.properties.time,
      sourceUrl: feature.properties.url,
    };
  });
}
