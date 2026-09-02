// app/dashboard/regions/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRegionRisk } from "@/hooks/useRegionRisk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const RegionPinMap = dynamic(
  () => import("@/app/components/RegionPinMap").then((mod) => mod.RegionPinMap),
  {
    ssr: false,
    loading: () => <p className="p-6 text-sm text-gray-500">Loading map...</p>,
  },
);

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function NewRegionPage(): React.JSX.Element {
  const router = useRouter();
  const { addRegion } = useRegionRisk();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [name, setName] = useState("");
  const [radiusKm, setRadiusKm] = useState("50");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced city/town search-as-you-type.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?mode=search&q=${encodeURIComponent(query)}`,
        );
        const data = (await res.json()) as SearchResult[];
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [query]);

  function pickSearchResult(result: SearchResult) {
    const lat = Number.parseFloat(result.lat);
    const lon = Number.parseFloat(result.lon);
    setPosition({ lat, lon });
    setName(result.display_name.split(",").slice(0, 2).join(","));
    setResults([]);
    setQuery(result.display_name);
  }

  async function handleMapPick(lat: number, lon: number) {
    setPosition({ lat, lon });
    if (!name) {
      // Best-effort reverse geocode to prefill a sensible name; user can edit it.
      try {
        const res = await fetch(
          `/api/geocode?mode=reverse&lat=${lat}&lon=${lon}`,
        );
        const data = await res.json();
        if (data?.display_name) {
          setName(data.display_name.split(",").slice(0, 2).join(","));
        }
      } catch {
        // Silent — pin placement itself still works without a prefilled name.
      }
    }
  }

  async function handleSubmit() {
    if (!position || !name) return;
    const radius = Number.parseFloat(radiusKm);
    if (Number.isNaN(radius)) return;
    setIsSubmitting(true);
    try {
      await addRegion({
        name,
        latitude: position.lat,
        longitude: position.lon,
        radiusKm: radius,
      });
      router.push("/dashboard/regions");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <h2 className="text-xl font-bold text-black dark:text-white">
        Add a region to watch
      </h2>

      <div className="relative">
        <Input
          placeholder="Search for a city or town (e.g. Kathmandu)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isSearching && (
          <p className="text-xs text-gray-500 mt-1">Searching...</p>
        )}
        {results.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full rounded-md border bg-white dark:bg-gray-900 dark:border-green-900/30 shadow-lg">
            {results.map((result) => (
              <button
                key={`${result.lat}-${result.lon}`}
                type="button"
                onClick={() => pickSearchResult(result)}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Or click directly on the map to drop a pin at any location.
      </p>

      <RegionPinMap
        position={position}
        radiusKm={Number.parseFloat(radiusKm) || 0}
        onPick={handleMapPick}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Input
          placeholder="Region name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Radius (km)"
          value={radiusKm}
          onChange={(e) => setRadiusKm(e.target.value)}
        />
        <div className="text-xs text-gray-500 flex items-center">
          {position
            ? `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`
            : "No location selected yet"}
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!position || !name || isSubmitting}
        className="bg-green-600 hover:bg-green-500 text-white"
      >
        {isSubmitting ? "Adding..." : "Add Region"}
      </Button>
    </div>
  );
}
