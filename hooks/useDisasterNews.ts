"use client";

// hooks/useDisasterNews.ts
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD", UTC
}

export function useDisasterNews() {
  const dateKey = todayDateKey();
  const report = useQuery(api.news.getReport, { dateKey });
  const generateAction = useAction(api.newsActions.generateDailyReport);
  const deleteMutation = useMutation(api.news.deleteReport);

  return {
    dateKey,
    report: report ?? null,
    isLoading: report === undefined,
    isGenerating: report?.status === "generating",
    generate: () => generateAction({}),
    deleteToday: () => deleteMutation({ dateKey }),
  };
}
