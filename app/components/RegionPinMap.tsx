// app/components/RegionPinMap.tsx
"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  useMapEvents,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface RegionPinMapProps {
  position: { lat: number; lon: number } | null;
  radiusKm: number;
  onPick: (lat: number, lon: number) => void;
}

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Recenters the map when a search result sets the position programmatically
// (a plain click already puts the map roughly where the user wants, but a
// search-driven pick can be anywhere on Earth relative to current view).
function RecenterOnPosition({
  position,
}: {
  position: { lat: number; lon: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lon], Math.max(map.getZoom(), 8));
    }
  }, [position, map]);
  return null;
}

export function RegionPinMap({
  position,
  radiusKm,
  onPick,
}: RegionPinMapProps) {
  return (
    <div
      className="rounded-lg overflow-hidden border dark:border-green-900/30"
      style={{ height: 420 }}
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onPick} />
        <RecenterOnPosition position={position} />
        {position && (
          <>
            <CircleMarker
              center={[position.lat, position.lon]}
              radius={8}
              pathOptions={{
                color: "#16a34a",
                fillColor: "#16a34a",
                fillOpacity: 0.9,
              }}
            />
            <Circle
              center={[position.lat, position.lon]}
              radius={radiusKm * 1000}
              pathOptions={{
                color: "#16a34a",
                fillOpacity: 0.05,
                dashArray: "4 4",
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
