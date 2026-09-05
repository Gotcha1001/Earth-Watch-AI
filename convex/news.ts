// import { v } from "convex/values";
// import { internalMutation, mutation, query } from "./_generated/server";

// export const getReport = query({
//   args: { dateKey: v.string() },
//   handler: async (ctx, { dateKey }) => {
//     return ctx.db
//       .query("disasterReports")
//       .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
//       .unique();
//   },
// });

// export const markGenerating = internalMutation({
//   args: { dateKey: v.string() },
//   handler: async (ctx, { dateKey }) => {
//     const existing = await ctx.db
//       .query("disasterReports")
//       .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
//       .unique();
//     if (existing) {
//       await ctx.db.patch(existing._id, {
//         status: "generating",
//         reason: undefined,
//       });
//     } else {
//       await ctx.db.insert("disasterReports", {
//         dateKey,
//         status: "generating",
//         commentary: undefined,
//         findings: [],
//         sources: [],
//         generatedAt: Date.now(),
//       });
//     }
//   },
// });

// export const saveReport = internalMutation({
//   args: {
//     dateKey: v.string(),
//     commentary: v.string(),
//     findings: v.array(v.any()),
//     sources: v.array(v.object({ title: v.string(), url: v.string() })),
//   },
//   handler: async (ctx, { dateKey, commentary, findings, sources }) => {
//     const existing = await ctx.db
//       .query("disasterReports")
//       .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
//       .unique();
//     const patch = {
//       status: "complete" as const,
//       commentary,
//       findings,
//       sources,
//       generatedAt: Date.now(),
//       reason: undefined,
//     };
//     if (existing) await ctx.db.patch(existing._id, patch);
//     else await ctx.db.insert("disasterReports", { dateKey, ...patch });
//   },
// });

// export const markFailed = internalMutation({
//   args: { dateKey: v.string(), reason: v.string() },
//   handler: async (ctx, { dateKey, reason }) => {
//     const existing = await ctx.db
//       .query("disasterReports")
//       .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
//       .unique();
//     if (existing)
//       await ctx.db.patch(existing._id, { status: "failed", reason });
//   },
// });

// // The other button. Deletes just the given day so the user can re-run a
// // fresh scrape, without wiping other days like clearAllEvents wipes
// // disasterEvents wholesale.
// export const deleteReport = mutation({
//   args: { dateKey: v.string() },
//   handler: async (ctx, { dateKey }) => {
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) throw new Error("Must be signed in to delete a report.");
//     const existing = await ctx.db
//       .query("disasterReports")
//       .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
//       .unique();
//     if (existing) await ctx.db.delete(existing._id);
//   },
// });

// // internal.news.pushSevereFindingsToAlerts would live here too, inserting
// // into your existing alerts table — wire it to whatever shape alerts.ts
// // already expects so it rides the same notification path My Regions uses.
// // Replaces pushSevereFindingsToAlerts from the last draft.
// export const createNotificationsForSevereFindings = internalMutation({
//   args: {
//     dateKey: v.string(),
//     findings: v.array(
//       v.object({
//         title: v.string(),
//         description: v.optional(v.string()),
//         location: v.optional(v.string()),
//         category: v.optional(v.string()),
//         link: v.optional(v.string()),
//       }),
//     ),
//   },
//   handler: async (ctx, { dateKey, findings }) => {
//     for (const f of findings) {
//       await ctx.db.insert("briefingNotifications", {
//         dateKey,
//         title: f.title,
//         description: f.description,
//         location: f.location,
//         category: f.category,
//         link: f.link,
//         read: false,
//         createdAt: Date.now(),
//       });
//     }
//   },
// });

// export const listUnreadNotifications = query({
//   args: {},
//   handler: async (ctx) => {
//     return ctx.db
//       .query("briefingNotifications")
//       .withIndex("by_read", (q) => q.eq("read", false))
//       .order("desc")
//       .take(50);
//   },
// });

// export const markNotificationRead = mutation({
//   args: { notificationId: v.id("briefingNotifications") },
//   handler: async (ctx, { notificationId }) => {
//     await ctx.db.patch(notificationId, { read: true });
//   },
// });

// export const markAllNotificationsRead = mutation({
//   args: {},
//   handler: async (ctx) => {
//     const unread = await ctx.db
//       .query("briefingNotifications")
//       .withIndex("by_read", (q) => q.eq("read", false))
//       .collect();
//     for (const n of unread) await ctx.db.patch(n._id, { read: true });
//   },
// });
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

export const getReport = query({
  args: { dateKey: v.string() },
  handler: async (ctx, { dateKey }) => {
    return ctx.db
      .query("disasterReports")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
      .unique();
  },
});

export const markGenerating = internalMutation({
  args: { dateKey: v.string() },
  handler: async (ctx, { dateKey }) => {
    const existing = await ctx.db
      .query("disasterReports")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "generating",
        reason: undefined,
      });
    } else {
      await ctx.db.insert("disasterReports", {
        dateKey,
        status: "generating",
        commentary: undefined,
        findings: [],
        sources: [],
        generatedAt: Date.now(),
      });
    }
  },
});

export const saveReport = internalMutation({
  args: {
    dateKey: v.string(),
    commentary: v.string(),
    findings: v.array(v.any()),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
  },
  handler: async (ctx, { dateKey, commentary, findings, sources }) => {
    const existing = await ctx.db
      .query("disasterReports")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
      .unique();
    const patch = {
      status: "complete" as const,
      commentary,
      findings,
      sources,
      generatedAt: Date.now(),
      reason: undefined,
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("disasterReports", { dateKey, ...patch });
  },
});

export const markFailed = internalMutation({
  args: { dateKey: v.string(), reason: v.string() },
  handler: async (ctx, { dateKey, reason }) => {
    const existing = await ctx.db
      .query("disasterReports")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
      .unique();
    if (existing)
      await ctx.db.patch(existing._id, { status: "failed", reason });
  },
});

// Deletes just the given day so the user can re-run a fresh scrape,
// without wiping other days like clearAllEvents wipes disasterEvents.
export const deleteReport = mutation({
  args: { dateKey: v.string() },
  handler: async (ctx, { dateKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be signed in to delete a report.");
    const existing = await ctx.db
      .query("disasterReports")
      .withIndex("by_dateKey", (q) => q.eq("dateKey", dateKey))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const createNotificationsForSevereFindings = internalMutation({
  args: {
    dateKey: v.string(),
    findings: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        location: v.optional(v.string()),
        category: v.optional(v.string()),
        link: v.optional(v.string()),
        // The disaster's own date (per the analyst prompt), not when we
        // detected it -- lets globalPriorityEngine.ts score on actual
        // recency instead of "0h ago" for every news-derived finding.
        publishedDate: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { dateKey, findings }) => {
    for (const f of findings) {
      await ctx.db.insert("briefingNotifications", {
        dateKey,
        title: f.title,
        description: f.description,
        location: f.location,
        category: f.category,
        link: f.link,
        publishedDate: f.publishedDate,
        read: false,
        createdAt: Date.now(),
      });
    }
  },
});

export const listUnreadNotifications = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("briefingNotifications")
      .withIndex("by_read", (q) => q.eq("read", false))
      .order("desc")
      .take(50);
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("briefingNotifications") },
  handler: async (ctx, { notificationId }) => {
    await ctx.db.patch(notificationId, { read: true });
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("briefingNotifications")
      .withIndex("by_read", (q) => q.eq("read", false))
      .collect();
    for (const n of unread) await ctx.db.patch(n._id, { read: true });
  },
});

// NEW -- feeds globalPriorityEngine.ts. briefingNotifications only ever
// contains findings newsActions.ts already filtered to severity === "severe",
// so every row here is fair game; we just need the recent ones. Not
// indexed on createdAt -- fine at this table's scale (severe items only),
// same reasoning as listEventsMissingLocationName in events.ts.
const RECENT_FINDINGS_WINDOW_MS = 1000 * 60 * 60 * 24; // 24h, matches the "last 24 hours" framing generateDailyReport already uses

export const listRecentSevereFindingsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RECENT_FINDINGS_WINDOW_MS;
    const all = await ctx.db.query("briefingNotifications").collect();
    return all.filter((n) => n.createdAt >= cutoff);
  },
});
