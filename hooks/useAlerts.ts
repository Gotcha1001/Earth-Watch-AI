// hooks/useAlerts.ts
"use client";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export interface UseAlertsResult {
  alerts: Doc<"alerts">[];
  isLoading: boolean;
  acknowledge: (alertId: Id<"alerts">) => Promise<void>;
}

export function useAlerts(): UseAlertsResult {
  const alerts = useQuery(api.alerts.getUserAlerts, {});
  const acknowledgeMutation = useMutation(api.alerts.acknowledgeAlert);

  return {
    alerts: alerts ?? [],
    isLoading: alerts === undefined,
    acknowledge: async (alertId) => {
      await acknowledgeMutation({ alertId });
    },
  };
}