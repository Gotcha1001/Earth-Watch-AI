// lib/api/gvp.ts
import type { NormalizedEvent } from "./usgs";

// Smithsonian Global Volcanism Program — the actual authoritative registry
// of "currently erupting" volcanoes. EONET's volcano coverage depends on a
// tiny number of observatories opting in, so most of the 40-50 volcanoes
// GVP considers "continuing" never show up there. This hits GVP's own
// public GeoServer WFS directly, no API key required.
const GVP_WFS_BASE =
  "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows";

// EndDateYear IS NULL is GVP's own definition of "still ongoing" — it's
// exactly what backs the "(continuing)" label on their Current Eruptions
// page.
const CQL_FILTER = "EndDateYear IS NULL";

interface GvpEruptionProperties {
  Volcano_Number: number;
  Volcano_Name: string | null;
  Eruption_Number: number;
  Activity_Type: string | null;
  ExplosivityIndexMax: number | null;
  StartDateYear: number | null;
  StartDateMonth: number | null;
  StartDateDay: number | null;
}

interface GvpFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  properties: GvpEruptionProperties;
}

interface GvpFeatureCollection {
  type: "FeatureCollection";
  features: GvpFeature[];
}

const BASE_SEVERITY = 70; // matches CATEGORY_BASE_SEVERITY.volcano in eonet.ts

function buildStartDate(props: GvpEruptionProperties): number {
  if (!props.StartDateYear) return Date.now();
  const month = (props.StartDateMonth ?? 1) - 1; // JS months are 0-indexed
  const day = props.StartDateDay ?? 1;
  return new Date(Date.UTC(props.StartDateYear, month, day)).getTime();
}

export async function fetchGvpEruptions(): Promise<NormalizedEvent[]> {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeName: "GVP-VOTW:Smithsonian_VOTW_Holocene_Eruptions",
    outputFormat: "json",
    CQL_FILTER,
  });
  const url = `${GVP_WFS_BASE}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GVP WFS request failed: ${response.status}`);
  }
  const data = (await response.json()) as GvpFeatureCollection;

  // A volcano can technically show up more than once if GVP logs more than
  // one open eruption episode for it — dedupe by volcano number so the map
  // shows one marker per volcano, not one per episode.
  const seen = new Set<number>();
  const normalized: NormalizedEvent[] = [];

  for (const feature of data.features) {
    const props = feature.properties;
    if (!feature.geometry || feature.geometry.type !== "Point") continue;
    if (seen.has(props.Volcano_Number)) continue;
    seen.add(props.Volcano_Number);

    const [longitude, latitude] = feature.geometry.coordinates;
    const name = props.Volcano_Name ?? `Volcano #${props.Volcano_Number}`;
    const vei = props.ExplosivityIndexMax;

    normalized.push({
      externalId: `gvp-${props.Volcano_Number}-${props.Eruption_Number}`,
      source: "gvp",
      category: "volcano",
      title: `${name} — continuing eruption`,
      description: props.Activity_Type ?? undefined,
      locationName: name,
      latitude,
      longitude,
      // Nudge severity up a little for higher-VEI ongoing eruptions,
      // capped so it never eclipses genuinely extreme events elsewhere.
      severity: vei ? Math.min(95, BASE_SEVERITY + vei * 3) : BASE_SEVERITY,
      rawSeverityLabel: vei ? `VEI ${vei}` : "Continuing eruption",
      occurredAt: buildStartDate(props),
      sourceUrl: `https://volcano.si.edu/volcano.cfm?vn=${props.Volcano_Number}`,
    });
  }

  return normalized;
}
