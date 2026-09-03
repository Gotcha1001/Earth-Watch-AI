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
    ),
    category: v.union(
      v.literal("earthquake"),
      v.literal("wildfire"),
      v.literal("flood"),
      v.literal("storm"),
      v.literal("volcano"),
      v.literal("severeWeather"),
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
    // Reverse-geocoded human-readable place name, filled in asynchronously
    // by convex/geocodeBackfill.ts after ingest — absent until then.
    locationName: v.optional(v.string()),
    firstSeenAt: v.optional(v.number()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_status_category", ["status", "category"])
    .index("by_occurredAt", ["occurredAt"])
    .index("by_dedupeKey_status", ["dedupeKey", "status"]),

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
        eventId: v.id("disasterEvents"),
        category: v.string(),
        title: v.string(),
        rawSeverityLabel: v.string(),
        severity: v.number(),
        hoursAgo: v.number(),
        latitude: v.number(),
        longitude: v.number(),
        // NEW: snapshot of the event's location name at briefing time.
        locationName: v.optional(v.string()),
      }),
    ),
    mostDangerousTitle: v.string(),
    notifyRecommended: v.boolean(),
    aiSummary: v.string(),
  }).index("by_generatedAt", ["generatedAt"]),
});
