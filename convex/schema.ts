// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  disasterEvents: defineTable({
    externalId: v.string(),
    source: v.union(
      v.literal("usgs"),
      v.literal("eonet"),
      v.literal("noaa"),
      v.literal("gvp"),
      v.literal("news"),
    ),
    category: v.union(
      v.literal("earthquake"),
      v.literal("wildfire"),
      v.literal("flood"),
      v.literal("storm"),
      v.literal("volcano"),
      v.literal("severeWeather"),
      v.literal("landslide"),
      v.literal("iceberg"),
      v.literal("tsunami"),
    ),
    title: v.string(),
    description: v.optional(v.string()),
    latitude: v.number(),
    longitude: v.number(),
    severity: v.number(),
    rawSeverityLabel: v.string(),
    occurredAt: v.number(),
    ingestedAt: v.number(),
    status: v.union(v.literal("active"), v.literal("resolved")),
    sourceUrl: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    locationName: v.optional(v.string()),
    firstSeenAt: v.optional(v.number()),
    // NEW — explicit indexed flag instead of relying on
    // `locationName === undefined` via an unindexed filter scan. Set true
    // at insert when no name was available yet, flipped to false the
    // moment geocodeBackfill.ts resolves one. Lets backfillLocationNames
    // query the index directly and get back an empty result almost for
    // free on a quiet tick, instead of scanning every row in the table.
    needsGeocode: v.optional(v.boolean()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_status_category", ["status", "category"])
    .index("by_occurredAt", ["occurredAt"])
    .index("by_dedupeKey_status", ["dedupeKey", "status"])
    .index("by_category_ingestedAt", ["category", "ingestedAt"])
    .index("by_needsGeocode", ["needsGeocode"]), // NEW

  watchedRegions: defineTable({
    userId: v.id("users"),
    name: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    radiusKm: v.number(),
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),

  riskAssessments: defineTable({
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
    generatedAt: v.number(),
  })
    .index("by_regionId", ["regionId"])
    .index("by_generatedAt", ["generatedAt"]),

  alerts: defineTable({
    userId: v.id("users"),
    regionId: v.id("watchedRegions"),
    assessmentId: v.id("riskAssessments"),
    riskLevel: v.union(
      v.literal("moderate"),
      v.literal("high"),
      v.literal("extreme"),
    ),
    message: v.string(),
    createdAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_acknowledged", ["userId", "acknowledgedAt"]),

  globalBriefings: defineTable({
    generatedAt: v.number(),
    topEvents: v.array(
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
    ),
    mostDangerousTitle: v.string(),
    notifyRecommended: v.boolean(),
    aiSummary: v.string(),
  }).index("by_generatedAt", ["generatedAt"]),

  disasterReports: defineTable({
    dateKey: v.string(),
    status: v.union(
      v.literal("generating"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    commentary: v.optional(v.string()),
    findings: v.array(v.any()),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    generatedAt: v.number(),
    reason: v.optional(v.string()),
  }).index("by_dateKey", ["dateKey"]),

  briefingNotifications: defineTable({
    dateKey: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    category: v.optional(v.string()),
    link: v.optional(v.string()),
    publishedDate: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_read", ["read"])
    .index("by_dateKey", ["dateKey"]),
});
