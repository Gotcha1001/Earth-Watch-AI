// // app/api/geocode/route.ts
// import { NextRequest, NextResponse } from "next/server";

// const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
// const HEADERS = { "User-Agent": "EarthWatchAI (contact: ops@earthwatch.ai)" };

// export async function GET(request: NextRequest) {
//   const { searchParams } = new URL(request.url);
//   const mode = searchParams.get("mode"); // "search" | "reverse"

//   if (mode === "reverse") {
//     const lat = searchParams.get("lat");
//     const lon = searchParams.get("lon");
//     if (!lat || !lon) {
//       return NextResponse.json(
//         { error: "lat and lon are required" },
//         { status: 400 },
//       );
//     }
//     const res = await fetch(
//       `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}`,
//       {
//         headers: HEADERS,
//       },
//     );
//     if (!res.ok) {
//       return NextResponse.json(
//         { error: "Reverse geocode failed" },
//         { status: 502 },
//       );
//     }
//     return NextResponse.json(await res.json());
//   }

//   const q = searchParams.get("q")?.trim() ?? "";
//   if (q.length < 2) {
//     return NextResponse.json([]);
//   }
//   const res = await fetch(
//     `${NOMINATIM_BASE}/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
//     { headers: HEADERS },
//   );
//   if (!res.ok) {
//     return NextResponse.json(
//       { error: "Geocode search failed" },
//       { status: 502 },
//     );
//   }
//   return NextResponse.json(await res.json());
// }
// app/api/geocode/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchPlace, reverseGeocode } from "@/lib/geocode";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode"); // "search" | "reverse"

  if (mode === "reverse") {
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    if (!lat || !lon) {
      return NextResponse.json(
        { error: "lat and lon are required" },
        { status: 400 },
      );
    }
    try {
      const result = await reverseGeocode(Number(lat), Number(lon));
      return NextResponse.json(result);
    } catch {
      return NextResponse.json(
        { error: "Reverse geocode failed" },
        { status: 502 },
      );
    }
  }

  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  try {
    return NextResponse.json(await searchPlace(q));
  } catch {
    return NextResponse.json(
      { error: "Geocode search failed" },
      { status: 502 },
    );
  }
}
