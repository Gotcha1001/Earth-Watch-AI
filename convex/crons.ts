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

// NEW — volcanoes split off from the 5-min cycle. Once/day is generous
// slack against how rarely GVP's "continuing eruption" list actually
// changes; drop to { hours: 6 } or { hours: 12 } if you want new
// eruptions to surface faster than a full day's delay.
crons.interval(
  "ingest volcano eruptions",
  { hours: 24 },
  internal.volcanoIngest.ingestVolcanoes,
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
  { minutes: 5 },
  internal.geocodeBackfill.backfillLocationNames,
  {},
);

crons.interval(
  "daily disaster briefing",
  { hours: 4 },
  internal.newsActions.generateDailyReportInternal,
  { force: false },
);

crons.interval(
  "prune old data",
  { hours: 6 },
  internal.cleanup.pruneOldData,
  {},
);

export default crons;
