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
    externalId: v.string(), // id from the source feed, used to dedupe on ingest
    source: v.union(
      v.literal("usgs"),
      v.literal("eonet"),
      v.literal("noaa"),
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
    severity: v.number(), // normalized 0-100 across all source types
    rawSeverityLabel: v.string(), // e.g. "M 5.6", "EXTREME", "Category 3"
    occurredAt: v.number(), // ms epoch, from the source
    ingestedAt: v.number(),
    status: v.union(v.literal("active"), v.literal("resolved")),
    sourceUrl: v.optional(v.string()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_status_category", ["status", "category"])
    .index("by_occurredAt", ["occurredAt"]),
 
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
    riskScore: v.number(), // 0-100
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
});