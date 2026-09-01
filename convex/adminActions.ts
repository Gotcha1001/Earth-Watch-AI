// convex/adminActions.ts
// ConvexHttpClient can only call PUBLIC functions, never `internal.*` ones —
// this thin public action is the one exposed entry point the Next.js API
// route (app/api/cron/ingest/route.ts) is allowed to call.
"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

export const runIngestAndAnalysis = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runAction(internal.eventsIngest.ingestAll, {});
    await ctx.runAction(internal.riskEngine.analyzeAllRegions, {});
  },
});