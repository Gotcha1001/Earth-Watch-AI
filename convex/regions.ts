// convex/regions.ts
import { v } from "convex/values";
import { mutation, query, internalQuery, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// Swap this for your existing users.ts lookup if you already have one —
// this is the minimal Clerk-identity -> users-row resolution.
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

export const addWatchedRegion = mutation({
  args: {
    name: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    radiusKm: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    return ctx.db.insert("watchedRegions", {
      userId: user._id,
      name: args.name,
      latitude: args.latitude,
      longitude: args.longitude,
      radiusKm: args.radiusKm,
      createdAt: Date.now(),
    });
  },
});

export const removeWatchedRegion = mutation({
  args: { regionId: v.id("watchedRegions") },
  handler: async (ctx, { regionId }) => {
    const user = await getAuthenticatedUser(ctx);
    const region = await ctx.db.get(regionId);
    if (!region || region.userId !== user._id) {
      throw new Error("Region not found");
    }
    await ctx.db.delete(regionId);
  },
});

export const getUserRegions = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    return ctx.db
      .query("watchedRegions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Used only by the risk-engine action (server-to-server, no user identity).
export const listAllRegions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("watchedRegions").collect();
  },
});