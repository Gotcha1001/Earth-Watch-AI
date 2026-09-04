// hooks/useVolcanoes.ts
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

export interface UseVolcanoesResult {
  volcanoes: Doc<"disasterEvents">[];
  isLoading: boolean;
}

export function useVolcanoes(): UseVolcanoesResult {
  const volcanoes = useQuery(api.events.listErupting, {});
  return {
    volcanoes: volcanoes ?? [],
    isLoading: volcanoes === undefined,
  };
}
