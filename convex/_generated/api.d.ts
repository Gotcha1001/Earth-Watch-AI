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
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as eventsIngest from "../eventsIngest.js";
import type * as regions from "../regions.js";
import type * as riskAssessments from "../riskAssessments.js";
import type * as riskEngine from "../riskEngine.js";
import type * as user from "../user.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminActions: typeof adminActions;
  alerts: typeof alerts;
  crons: typeof crons;
  events: typeof events;
  eventsIngest: typeof eventsIngest;
  regions: typeof regions;
  riskAssessments: typeof riskAssessments;
  riskEngine: typeof riskEngine;
  user: typeof user;
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
