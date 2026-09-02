// components/LiveDisasterMap.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  CircleMarker,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useDisasterEvents } from "@/hooks/useDisasterEvents";
import { useRegionRisk } from "@/hooks/useRegionRisk";
import type { Doc } from "@/convex/_generated/dataModel";

const CATEGORY_COLOR: Record<Doc<"disasterEvents">["category"], string> = {
  earthquake: "#f97316",
  wildfire: "#dc2626",
  flood: "#2563eb",
  storm: "#7c3aed",
  volcano: "#b91c1c",
  severeWeather: "#eab308",
};

const CATEGORY_LABEL: Record<Doc<"disasterEvents">["category"], string> = {
  earthquake: "Earthquake",
  wildfire: "Wildfire",
  flood: "Flood",
  storm: "Storm",
  volcano: "Volcano",
  severeWeather: "Severe Weather",
};

function MapLegend(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      {(Object.keys(CATEGORY_LABEL) as Doc<"disasterEvents">["category"][]).map(
        (category) => (
          <span key={category} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLOR[category] }}
            />
            {CATEGORY_LABEL[category]}
          </span>
        ),
      )}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-green-600" />
        Watched region
      </span>
    </div>
  );
}

// Leaflet's default control chrome (zoom buttons, layer picker, attribution)
// renders as a plain white box, which reads as a jarring UI mistake against
// a dark dashboard. This keeps the same controls but themes them to match.
// Replace DARK_CONTROL_STYLES with this. Scoped to `.dark` so it follows
// whatever class your app already uses to toggle dark mode (same one
// driving the `dark:` Tailwind classes above).
const CONTROL_STYLES = `
  /* Light mode */
  .earthwatch-map .leaflet-control-zoom a,
  .earthwatch-map .leaflet-control-layers,
  .earthwatch-map .leaflet-control-attribution {
    background-color: rgba(255, 255, 255, 0.97);
    color: #111827;
    border: 1px solid rgba(22, 163, 74, 0.35);
  }
  .earthwatch-map .leaflet-control-zoom a { color: #111827; }
  .earthwatch-map .leaflet-control-zoom a:hover { background-color: rgba(22, 163, 74, 0.15); }
  .earthwatch-map .leaflet-control-attribution a { color: #15803d; }

  .earthwatch-map .leaflet-control-layers-list label {
    color: #111827;
    font-size: 13px;
    padding: 4px 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .earthwatch-map .leaflet-control-layers-list label:hover {
    background-color: rgba(22, 163, 74, 0.12);
  }
  .earthwatch-map .leaflet-control-layers-selector:checked + span {
    font-weight: 700;
    color: #15803d;
  }
  .earthwatch-map .leaflet-control-layers-separator {
    border-color: rgba(22, 163, 74, 0.25);
  }

  /* Dark mode */
  .dark .earthwatch-map .leaflet-control-zoom a,
  .dark .earthwatch-map .leaflet-control-layers,
  .dark .earthwatch-map .leaflet-control-attribution {
    background-color: rgba(17, 24, 39, 0.97);
    color: #e5e7eb;
    border: 1px solid rgba(22, 163, 74, 0.4);
  }
  .dark .earthwatch-map .leaflet-control-zoom a { color: #e5e7eb; }
  .dark .earthwatch-map .leaflet-control-zoom a:hover { background-color: rgba(22, 163, 74, 0.3); }
  .dark .earthwatch-map .leaflet-control-layers-toggle { filter: invert(1); }
  .dark .earthwatch-map .leaflet-control-attribution a { color: #86efac; }

  .dark .earthwatch-map .leaflet-control-layers-list label {
    color: #e5e7eb;
  }
  .dark .earthwatch-map .leaflet-control-layers-list label:hover {
    background-color: rgba(22, 163, 74, 0.22);
  }
  .dark .earthwatch-map .leaflet-control-layers-selector:checked + span {
    font-weight: 700;
    color: #86efac;
  }
  .dark .earthwatch-map .leaflet-control-layers-separator {
    border-color: rgba(22, 163, 74, 0.3);
  }
`;

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;

// Below this zoom, the world's projected image (256 * 2^zoom px tall) is
// shorter than the ~560px map box, leaving gray gaps above/below with
// nothing wrong — it's the edge of the projection, not missing tiles.
// zoom 2 = 1024px world height, comfortably taller than the box.
const MIN_ZOOM = 2;
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-85.06, -Infinity],
  [85.06, Infinity],
];

/** GIBS mosaics a given day's satellite passes progressively — "today" is
 * usually incomplete/patchy until all passes finish, so default to
 * yesterday (UTC) for guaranteed full global coverage, and let the user
 * pick a different date if they want. */
function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function gibsUrl(layer: string, time: string, ext: "jpg" | "png"): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.${ext}`;
}

/** Leaflet measures its container's pixel size once on mount. Loading this
 * map via next/dynamic swaps a placeholder <p> for the real DOM after
 * mount, which can happen before the layout has settled — Leaflet then
 * keeps using the too-small size it first measured (visible as gray
 * padding and a tile grid that only fills part of the box, especially
 * zoomed out). Forcing a re-measure after mount and on window resize
 * fixes it without needing any layout changes elsewhere. */
function MapResizeFix(): null {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const timeoutId = window.setTimeout(invalidate, 0);
    window.addEventListener("resize", invalidate);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);
  return null;
}

function MapFocusHandler({
  markersRef,
}: {
  markersRef: React.MutableRefObject<Map<string, LeafletCircleMarker>>;
}): null {
  const map = useMap();
  const searchParams = useSearchParams();

  useEffect(() => {
    const lat = parseFloat(searchParams.get("lat") ?? "");
    const lng = parseFloat(searchParams.get("lng") ?? "");
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    const zoom = Number(searchParams.get("zoom") ?? 8);
    map.flyTo([lat, lng], zoom, { duration: 1 });

    const id = searchParams.get("id");
    if (!id) return;
    // markers register their ref slightly after mount — give them a beat
    const timeoutId = window.setTimeout(() => {
      markersRef.current.get(id)?.openPopup();
    }, 300);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, searchParams]);

  return null;
}

export function LiveDisasterMap(): React.JSX.Element {
  const { events } = useDisasterEvents();
  const { regions } = useRegionRisk();
  const [imageryDate, setImageryDate] = useState<string>(yesterdayUtc());
  const markersRef = useRef<Map<string, LeafletCircleMarker>>(new Map());

  const viirsUrl = useMemo(
    () =>
      gibsUrl("VIIRS_SNPP_CorrectedReflectance_TrueColor", imageryDate, "jpg"),
    [imageryDate],
  );
  const modisUrl = useMemo(
    () =>
      gibsUrl("MODIS_Terra_CorrectedReflectance_TrueColor", imageryDate, "jpg"),
    [imageryDate],
  );
  const fireOverlayUrl = useMemo(
    () => gibsUrl("VIIRS_SNPP_Thermal_Anomalies_375m_All", imageryDate, "png"),
    [imageryDate],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="imagery-date" className="text-black dark:text-white">
          Satellite imagery date (UTC):
        </label>
        <input
          id="imagery-date"
          type="date"
          value={imageryDate}
          max={yesterdayUtc()}
          onChange={(e) => setImageryDate(e.target.value)}
          className="rounded border px-2 py-1 bg-white dark:bg-gray-900 dark:border-green-900/30"
        />
        <span className="text-xs text-black dark:text-white">
          NASA GIBS mosaics each day&apos;s satellite passes — today&apos;s data
          is usually incomplete, so this defaults to the most recent complete
          day.
        </span>
      </div>

      <div
        className="earthwatch-map rounded-lg overflow-hidden border dark:border-green-900/30"
        style={{ height: 560 }}
      >
        <style>{CONTROL_STYLES}</style>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          minZoom={MIN_ZOOM}
          maxBounds={WORLD_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ height: "100%", width: "100%" }}
          worldCopyJump
        >
          <MapResizeFix />
          <MapFocusHandler markersRef={markersRef} />

          {events.map((event) => (
            <CircleMarker
              key={event._id}
              ref={(instance) => {
                if (instance) markersRef.current.set(event._id, instance);
                else markersRef.current.delete(event._id);
              }}
              center={[event.latitude, event.longitude]}
              radius={4 + event.severity / 12}
              pathOptions={{
                color: CATEGORY_COLOR[event.category],
                fillColor: CATEGORY_COLOR[event.category],
                fillOpacity: 0.6,
              }}
            >
              <Popup>
                <strong>{event.title}</strong>
                <br />
                {event.rawSeverityLabel}
                <br />
                {new Date(event.occurredAt).toLocaleString()}
              </Popup>
            </CircleMarker>
          ))}
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Terrain (green)">
              <TileLayer
                attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                maxNativeZoom={17}
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Street Map">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Satellite (VIIRS true color)">
              <TileLayer
                attribution="Imagery: NASA GIBS / VIIRS (Suomi NPP)"
                url={viirsUrl}
                maxNativeZoom={9}
                maxZoom={12}
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Satellite (MODIS true color)">
              <TileLayer
                attribution="Imagery: NASA GIBS / MODIS (Terra)"
                url={modisUrl}
                maxNativeZoom={9}
                maxZoom={12}
              />
            </LayersControl.BaseLayer>

            <LayersControl.Overlay name="Active fire hotspots (VIIRS)">
              <TileLayer
                attribution="NASA GIBS / VIIRS Thermal Anomalies"
                url={fireOverlayUrl}
                maxNativeZoom={8}
                maxZoom={12}
              />
            </LayersControl.Overlay>
          </LayersControl>

          {events.map((event) => (
            <CircleMarker
              key={event._id}
              center={[event.latitude, event.longitude]}
              radius={4 + event.severity / 12}
              pathOptions={{
                color: CATEGORY_COLOR[event.category],
                fillColor: CATEGORY_COLOR[event.category],
                fillOpacity: 0.6,
              }}
            >
              <Popup>
                <strong>{event.title}</strong>
                <br />
                {event.rawSeverityLabel}
                <br />
                {new Date(event.occurredAt).toLocaleString()}
              </Popup>
            </CircleMarker>
          ))}

          {regions.map((region) => (
            <Circle
              key={region._id}
              center={[region.latitude, region.longitude]}
              radius={region.radiusKm * 1000}
              pathOptions={{
                color: "#16a34a",
                fillOpacity: 0.05,
                dashArray: "4 4",
              }}
            >
              <Popup>{region.name}</Popup>
            </Circle>
          ))}
        </MapContainer>
      </div>

      <MapLegend />
    </div>
  );
}
