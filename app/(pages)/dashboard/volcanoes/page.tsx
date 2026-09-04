// app/dashboard/volcanoes/page.tsx
"use client";

import dynamic from "next/dynamic";

const VolcanoMap = dynamic(
  () => import("@/app/components/VolcanoMap").then((mod) => mod.VolcanoMap),
  {
    ssr: false,
    loading: () => (
      <p className="p-6 text-sm text-gray-500">Loading volcano map...</p>
    ),
  },
);

export default function VolcanoesPage(): React.JSX.Element {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-3 text-black dark:text-white">
        Active Volcanoes
      </h2>
      <VolcanoMap />
    </div>
  );
}
