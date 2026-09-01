import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createOrGet = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthorized – no identity found");
    }

    console.log("[createOrGet] Identity:", JSON.stringify(identity, null, 2));

    const clerkId = identity.subject;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existing) {
      console.log("[createOrGet] Returning existing user:", existing._id);
      return existing;
    }

    // Safe extraction
    const email = typeof identity.email === "string" ? identity.email : "";

    const name =
      typeof identity.name === "string"
        ? identity.name
        : typeof identity.givenName === "string"
          ? identity.givenName
          : "Unknown User";

    // Use givenName / familyName if you want to store them separately later
    // For now we're keeping name as full name
    const imageUrl =
      typeof identity.pictureUrl === "string"
        ? identity.pictureUrl
        : typeof identity.picture === "string"
          ? identity.picture
          : typeof identity.image === "string"
            ? identity.image
            : undefined;

    console.log("[createOrGet] Creating new user with:", {
      clerkId,
      email,
      name,
      imageUrl: imageUrl ? "present" : "missing",
    });

    const userId = await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      imageUrl,
      role: "user" as const,
      createdAt: Date.now(),
    });

    const newUser = await ctx.db.get(userId);

    if (newUser) {
      console.log("[createOrGet] Successfully created user:", newUser._id);
    } else {
      console.error("[createOrGet] Failed to retrieve new user");
    }

    return newUser;
  },
});

export const getMe = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return (
      (await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first()) ?? null
    );
  },
});
