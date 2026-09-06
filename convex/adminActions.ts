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
    // NEW — volcanoIngest.ts runs on its own daily cron now (see crons.ts),
    // but this external trigger is a separate manual/backup path, so it
    // should still cover the full ingest surface when someone hits it —
    // otherwise an operator calling this expecting "refresh everything"
    // would silently get everything except volcanoes.
    await ctx.runAction(internal.volcanoIngest.ingestVolcanoes, {});
    await ctx.runAction(internal.riskEngine.analyzeAllRegions, {});
  },
});
