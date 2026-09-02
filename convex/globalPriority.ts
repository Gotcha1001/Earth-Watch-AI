// convex/globalPriority.ts — default runtime
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const recordGlobalBriefing = internalMutation({
  args: {
    topEvents: v.array(
      v.object({
        eventId: v.id("disasterEvents"),
        category: v.string(),
        title: v.string(),
        rawSeverityLabel: v.string(),
        severity: v.number(),
        hoursAgo: v.number(),
        latitude: v.number(), // add
        longitude: v.number(), // add
        locationName: v.optional(v.string()), // add
      }),
    ),
    mostDangerousTitle: v.string(),
    notifyRecommended: v.boolean(),
    aiSummary: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("globalBriefings", {
      ...args,
      generatedAt: Date.now(),
    });
  },
});

export const getLatestGlobalBriefing = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("globalBriefings")
      .withIndex("by_generatedAt")
      .order("desc")
      .first();
  },
});
