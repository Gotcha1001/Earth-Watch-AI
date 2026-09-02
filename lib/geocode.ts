// lib/geocode.ts
// Shared reverse/forward geocoding client for Nominatim (OpenStreetMap),
// used by both app/api/geocode/route.ts (interactive region-picker lookups)
// and convex/geocodeBackfill.ts (server-side event location names).
// Nominatim's usage policy asks for ~1 request/second max and a
// descriptive User-Agent — both call sites route through this one queue
// so they never collectively exceed that within a given process.

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const HEADERS = { "User-Agent": "EarthWatchAI (contact: ops@earthwatch.ai)" };
const MIN_INTERVAL_MS = 1100; // just over 1 req/sec, with margin

let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

/** Chains `task` behind any already-queued calls and enforces a minimum
 * gap since the last actual network call, so however many callers are
 * waiting, only one Nominatim request goes out at a time. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return task();
  });
  // Don't let one failed lookup wedge everything queued behind it.
  queue = run.catch(() => undefined);
  return run;
}

export interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

export function searchPlace(
  query: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  return schedule(async () => {
    const res = await fetch(
      `${NOMINATIM_BASE}/search?format=json&limit=${limit}&q=${encodeURIComponent(query)}`,
      { headers: HEADERS },
    );
    if (!res.ok) throw new Error(`Geocode search failed: ${res.status}`);
    return (await res.json()) as GeocodeResult[];
  });
}

export function reverseGeocode(
  lat: number,
  lon: number,
): Promise<{ display_name: string } | null> {
  return schedule(async () => {
    const res = await fetch(
      `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}`,
      { headers: HEADERS },
    );
    if (!res.ok) throw new Error(`Reverse geocode failed: ${res.status}`);
    return (await res.json()) as { display_name: string };
  });
}

/** Shortens a full Nominatim address into a compact "City, Region, Country"
 * style label suitable for cards and lists. */
export function shortLocationName(displayName: string): string {
  return displayName.split(",").slice(0, 3).join(",").trim();
}
