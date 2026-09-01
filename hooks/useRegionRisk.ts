// hooks/useRegionRisk.ts
"use client";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export interface UseRegionRiskResult {
  regions: Doc<"watchedRegions">[];
  isLoading: boolean;
  addRegion: (input: { name: string; latitude: number; longitude: number; radiusKm: number }) => Promise<Id<"watchedRegions">>;
  removeRegion: (regionId: Id<"watchedRegions">) => Promise<void>;
}

export function useRegionRisk(): UseRegionRiskResult {
  const regions = useQuery(api.regions.getUserRegions, {});
  const addRegionMutation = useMutation(api.regions.addWatchedRegion);
  const removeRegionMutation = useMutation(api.regions.removeWatchedRegion);

  return {
    regions: regions ?? [],
    isLoading: regions === undefined,
    addRegion: (input) => addRegionMutation(input),
    removeRegion: async (regionId) => {
      await removeRegionMutation({ regionId });
    },
  };
}

export function useLatestAssessment(regionId: Id<"watchedRegions"> | undefined) {
  return useQuery(
    api.riskAssessments.getLatestForRegion,
    regionId ? { regionId } : "skip",
  );
}