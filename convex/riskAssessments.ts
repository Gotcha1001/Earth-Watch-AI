// convex/riskAssessments.ts  — default runtime
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const recordAssessment = internalMutation({
  args: {
    regionId: v.id("watchedRegions"),
    riskScore: v.number(),
    riskLevel: v.union(
      v.literal("low"),
      v.literal("moderate"),
      v.literal("high"),
      v.literal("extreme"),
    ),
    contributingEventIds: v.array(v.id("disasterEvents")),
    aiSummary: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("riskAssessments", {
      ...args,
      generatedAt: Date.now(),
    });
  },
});

export const getLatestForRegion = query({
  args: { regionId: v.id("watchedRegions") },
  handler: async (ctx, { regionId }) => {
    return ctx.db
      .query("riskAssessments")
      .withIndex("by_regionId", (q) => q.eq("regionId", regionId))
      .order("desc")
      .first();
  },
});

export const getLatestForRegionInternal = internalQuery({
  args: { regionId: v.id("watchedRegions") },
  handler: async (ctx, { regionId }) => {
    return ctx.db
      .query("riskAssessments")
      .withIndex("by_regionId", (q) => q.eq("regionId", regionId))
      .order("desc")
      .first();
  },
});
