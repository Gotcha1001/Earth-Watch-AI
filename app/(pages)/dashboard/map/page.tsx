// app/dashboard/map/page.tsx
"use client";
import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so it can only run in the browser —
// ssr:false keeps it out of the server render entirely.
const LiveDisasterMap = dynamic(
  () => import("@/app/components/LiveDisasterMap").then((mod) => mod.LiveDisasterMap),
  { ssr: false, loading: () => <p className="p-6 text-sm text-gray-500">Loading map…</p> },
);

export default function MapPage(): React.JSX.Element {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-3 text-black dark:text-white">Live Map</h2>
      <LiveDisasterMap />
    </div>
  );
}