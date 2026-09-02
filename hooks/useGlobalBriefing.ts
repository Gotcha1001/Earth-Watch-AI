"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useGlobalBriefing() {
  const briefing = useQuery(api.globalPriority.getLatestGlobalBriefing, {});
  return { briefing: briefing ?? null, isLoading: briefing === undefined };
}
