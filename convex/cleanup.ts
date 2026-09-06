import { internalMutation } from "./_generated/server";

// convex/cleanup.ts
export const pruneOldData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // hard-delete resolved events older than 30 days
    const oldEvents = await ctx.db
      .query("disasterEvents")
      .withIndex("by_occurredAt", (q) =>
        q.lt("occurredAt", now - 30 * 86400000),
      )
      .filter((q) => q.eq(q.field("status"), "resolved"))
      .collect();
    for (const e of oldEvents) await ctx.db.delete(e._id);

    // keep only the last ~50 global briefings
    const briefings = await ctx.db
      .query("globalBriefings")
      .withIndex("by_generatedAt")
      .order("desc")
      .collect();
    for (const b of briefings.slice(50)) await ctx.db.delete(b._id);

    // drop acknowledged alerts older than 14 days
    const oldAlerts = await ctx.db.query("alerts").collect();
    for (const a of oldAlerts) {
      if (a.acknowledgedAt && now - a.acknowledgedAt > 14 * 86400000)
        await ctx.db.delete(a._id);
    }
  },
});
