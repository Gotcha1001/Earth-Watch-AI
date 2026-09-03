// hooks/useDisasterEvents.ts
"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

export interface UseDisasterEventsResult {
  events: Doc<"disasterEvents">[];
  isLoading: boolean;
}

export function useDisasterEvents(): UseDisasterEventsResult {
  const events = useQuery(api.events.listActiveEvents, {});
  return {
    events: events ?? [],
    isLoading: events === undefined,
  };
}
