// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "ingest disaster feeds",
  { minutes: 5 },
  internal.eventsIngest.ingestAll,
  {},
);

crons.interval(
  "analyze region risk",
  { minutes: 20 },
  internal.riskEngine.analyzeAllRegions,
  {},
);

crons.interval(
  "global priority briefing",
  { minutes: 15 },
  internal.globalPriorityEngine.analyzeGlobalPriority,
  {},
);

crons.interval(
  "backfill event location names",
  { minutes: 1 },
  internal.geocodeBackfill.backfillLocationNames,
  {},
);

export default crons;
