// convex/alerts.ts  — default runtime
import { v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

async function getAuthenticatedUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) throw new Error("User record not found");
  return user;
}

// Called by the risk engine when a region crosses "moderate" or higher.
export const createAlertForRegion = internalMutation({
  args: {
    userId: v.id("users"),
    regionId: v.id("watchedRegions"),
    assessmentId: v.id("riskAssessments"),
    riskLevel: v.union(v.literal("moderate"), v.literal("high"), v.literal("extreme")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("alerts", { ...args, createdAt: Date.now() });
  },
});

export const getUserAlerts = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return ctx.db
      .query("alerts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);
  },
});

export const acknowledgeAlert = mutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, { alertId }) => {
    const user = await getAuthenticatedUser(ctx);
    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== user._id) {
      throw new Error("Alert not found");
    }
    await ctx.db.patch(alertId, { acknowledgedAt: Date.now() });
  },
});