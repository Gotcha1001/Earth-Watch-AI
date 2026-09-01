// app/api/cron/ingest/route.ts
// Convex crons.ts already schedules ingestion automatically; this route exists
// as a manual/external trigger (e.g. Vercel Cron hitting this URL, or a
// "Refresh now" button) that's independent of Convex's own scheduler.
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_CONVEX_URL" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);
  await client.action(api.adminActions.runIngestAndAnalysis, {});

  return NextResponse.json({ ok: true, triggeredAt: new Date().toISOString() });
}