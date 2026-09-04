"use client";

// components/BriefingNotificationBell.tsx
//
// The bell + red-dot badge sits inline next to the "Daily Briefing" sidebar
// link (same treatment as the existing Dashboard red-dot in
// AppSidebar.tsx). Clicking it opens a small standalone panel — this is
// intentionally separate from wherever the Alerts page renders My Regions
// alerts; it reads briefingNotifications only.

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useBriefingNotifications } from "@/hooks/useBriefingNotifications";
import { Button } from "@/components/ui/button";

export function BriefingNotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } =
    useBriefingNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={`${unreadCount} unread disaster notifications`}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-6 w-6 items-center justify-center rounded hover:bg-cyan-400/10"
      >
        <Bell className="h-4 w-4 text-cyan-200/80" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-cyan-400/20 bg-[#04070a] shadow-[0_0_40px_-10px_rgba(34,211,238,0.4)]">
          <div className="flex items-center justify-between border-b border-cyan-400/10 px-3 py-2">
            <span className="font-[family-name:var(--font-hud)] text-xs uppercase tracking-wide text-cyan-200/70">
              Severe findings
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="text-xs text-cyan-300 hover:text-cyan-100"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-gray-500">
                No unread notifications.
              </p>
            )}
            {notifications.map((n) => (
              <div
                key={n._id}
                className="border-b border-cyan-400/5 px-3 py-2 last:border-b-0 hover:bg-cyan-400/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-cyan-50">{n.title}</p>
                  <button
                    type="button"
                    onClick={() => markRead(n._id)}
                    className="shrink-0 text-[11px] text-cyan-300/70 hover:text-cyan-100"
                  >
                    Mark read
                  </button>
                </div>
                {n.location && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    📍 {n.location}
                  </p>
                )}
                {n.link && (
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-xs text-cyan-400 hover:underline"
                  >
                    Source ↗
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-cyan-400/10 px-3 py-2">
            <Button asChild size="sm" variant="ghost" className="w-full">
              <Link
                href="/dashboard/disaster-news"
                onClick={() => setOpen(false)}
              >
                View full report
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
