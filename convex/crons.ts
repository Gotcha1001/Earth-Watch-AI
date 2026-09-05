// // convex/crons.ts
// import { cronJobs } from "convex/server";
// import { internal } from "./_generated/api";

// const crons = cronJobs();

// crons.interval(
//   "ingest disaster feeds",
//   { minutes: 5 },
//   internal.eventsIngest.ingestAll,
//   {},
// );

// crons.interval(
//   "analyze region risk",
//   { minutes: 20 },
//   internal.riskEngine.analyzeAllRegions,
//   {},
// );

// crons.interval(
//   "global priority briefing",
//   { minutes: 15 },
//   internal.globalPriorityEngine.analyzeGlobalPriority,
//   {},
// );

// crons.interval(
//   "backfill event location names",
//   { minutes: 1 },
//   internal.geocodeBackfill.backfillLocationNames,
//   {},
// );

// export default crons;

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

// NEW -- makes the Daily Briefing (Tavily -> OpenRouter commentary +
// findings) proactive instead of living entirely behind the "Generate"
// button. force: false, so this is a no-op if today's report is still
// fresh (see REGEN_COOLDOWN_MS in newsActions.ts) -- keeps the Tavily/
// OpenRouter spend bounded even though this fires 6x/day.
crons.interval(
  "daily disaster briefing",
  { hours: 4 },
  internal.newsActions.generateDailyReportInternal,
  { force: false },
);

export default crons;
