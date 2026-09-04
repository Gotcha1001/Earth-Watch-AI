"use client";

// hooks/useBriefingNotifications.ts
//
// Deliberately separate from hooks/useAlerts.ts — this reads
// briefingNotifications (severe findings spun off from the daily
// disaster scrape), not the My Regions "alerts" table.

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useBriefingNotifications() {
  const notifications = useQuery(api.news.listUnreadNotifications, {});
  const markReadMutation = useMutation(api.news.markNotificationRead);
  const markAllReadMutation = useMutation(api.news.markAllNotificationsRead);

  return {
    notifications: notifications ?? [],
    unreadCount: notifications?.length ?? 0,
    isLoading: notifications === undefined,
    markRead: (notificationId: Id<"briefingNotifications">) =>
      markReadMutation({ notificationId }),
    markAllRead: () => markAllReadMutation({}),
  };
}
