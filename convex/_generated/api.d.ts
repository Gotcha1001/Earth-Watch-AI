/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminActions from "../adminActions.js";
import type * as alerts from "../alerts.js";
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as eventsIngest from "../eventsIngest.js";
import type * as geocodeBackfill from "../geocodeBackfill.js";
import type * as globalPriority from "../globalPriority.js";
import type * as globalPriorityEngine from "../globalPriorityEngine.js";
import type * as news from "../news.js";
import type * as newsActions from "../newsActions.js";
import type * as regions from "../regions.js";
import type * as riskAssessments from "../riskAssessments.js";
import type * as riskEngine from "../riskEngine.js";
import type * as user from "../user.js";
import type * as volcanoIngest from "../volcanoIngest.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminActions: typeof adminActions;
  alerts: typeof alerts;
  cleanup: typeof cleanup;
  crons: typeof crons;
  events: typeof events;
  eventsIngest: typeof eventsIngest;
  geocodeBackfill: typeof geocodeBackfill;
  globalPriority: typeof globalPriority;
  globalPriorityEngine: typeof globalPriorityEngine;
  news: typeof news;
  newsActions: typeof newsActions;
  regions: typeof regions;
  riskAssessments: typeof riskAssessments;
  riskEngine: typeof riskEngine;
  user: typeof user;
  volcanoIngest: typeof volcanoIngest;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
