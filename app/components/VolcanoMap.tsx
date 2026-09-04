// components/VolcanoMap.tsx
"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { useVolcanoes } from "@/hooks/useVolcanoes";

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-85.06, -180],
  [85.06, 180],
];

// Same fit-to-container fix used on LiveDisasterMap, so this page never
// shows gray gutters on wide screens either.
function MapFitFix(): null {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      const fitZoom = map.getBoundsZoom(WORLD_BOUNDS, true);
      map.setMinZoom(fitZoom);
      if (map.getZoom() < fitZoom) map.setZoom(fitZoom);
    };
    const timeoutId = window.setTimeout(fit, 0);
    window.addEventListener("resize", fit);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", fit);
    };
  }, [map]);
  return null;
}

export function VolcanoMap(): React.JSX.Element {
  const { volcanoes, isLoading } = useVolcanoes();

  // Sort so higher-VEI eruptions render on top of lower ones when
  // markers overlap at world zoom.
  const sorted = useMemo(
    () => [...volcanoes].sort((a, b) => a.severity - b.severity),
    [volcanoes],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-black dark:text-white">
        <span>
          {isLoading
            ? "Loading active volcanoes..."
            : `${volcanoes.length} volcano${volcanoes.length === 1 ? "" : "es"} currently erupting (Smithsonian GVP)`}
        </span>
      </div>

      <div className="earthwatch-map w-full h-[75vh] min-h-[600px] rounded-lg overflow-hidden border dark:border-green-900/30">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          maxBounds={WORLD_BOUNDS}
          maxBoundsViscosity={1.0}
          style={{ height: "100%", width: "100%" }}
        >
          <MapFitFix />
          <TileLayer
            attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxNativeZoom={17}
            noWrap
          />
          {sorted.map((volcano) => (
            <CircleMarker
              key={volcano._id}
              center={[volcano.latitude, volcano.longitude]}
              // Bigger baseline than the main map's markers, since this
              // page only ever plots volcanoes and needs them to stay
              // legible when several sit close together.
              radius={6 + volcano.severity / 10}
              pathOptions={{
                color: "#b91c1c",
                fillColor: "#f97316",
                fillOpacity: 0.75,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{volcano.locationName ?? volcano.title}</strong>
                <br />
                {volcano.rawSeverityLabel}
                <br />
                Erupting since{" "}
                {new Date(volcano.occurredAt).toLocaleDateString()}
                {volcano.sourceUrl && (
                  <>
                    <br />
                    <a
                      href={volcano.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on Smithsonian GVP
                    </a>
                  </>
                )}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
