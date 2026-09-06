// convex/globalPriority.ts -- default runtime
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const topEventArgs = v.array(
  v.object({
    sourceId: v.string(),
    source: v.union(v.literal("structured"), v.literal("news")),
    category: v.string(),
    title: v.string(),
    rawSeverityLabel: v.string(),
    severity: v.number(),
    hoursAgo: v.number(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    locationName: v.optional(v.string()),
    link: v.optional(v.string()),
  }),
);

// CHANGED — this used to insert a brand-new row every single cron tick
// (every 15 min, 96/day, forever) no matter what. The problem: `topEvents`
// always looks "different" between ticks because `hoursAgo` recalculates
// every time even when the underlying situation hasn't moved at all —
// so a naive "did the whole payload change" check would never dedupe
// anything either. What actually matters to a user checking this table is
// just two things: which event is currently flagged most dangerous, and
// whether we're telling them to sit up and pay attention. If neither of
// those changed since the last row, this is a no-op tick — skip the
// insert and just hand back the existing row's id.
export const recordGlobalBriefing = internalMutation({
  args: {
    topEvents: topEventArgs,
    mostDangerousTitle: v.string(),
    notifyRecommended: v.boolean(),
    aiSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("globalBriefings")
      .withIndex("by_generatedAt")
      .order("desc")
      .first();

    const unchanged =
      latest &&
      latest.mostDangerousTitle === args.mostDangerousTitle &&
      latest.notifyRecommended === args.notifyRecommended;

    if (unchanged) {
      console.log(
        `[globalPriority] recordGlobalBriefing: no change since last briefing ("${args.mostDangerousTitle}", notify=${args.notifyRecommended}) — skipping insert`,
      );
      return latest._id;
    }

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

// NEW — internal-only mirror of getLatestGlobalBriefing, for server-to-server
// callers (e.g. globalPriorityEngine.ts, or anything else that wants to
// compare against the current briefing without going through the public,
// client-facing query).
export const getLatestGlobalBriefingInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("globalBriefings")
      .withIndex("by_generatedAt")
      .order("desc")
      .first();
  },
});
