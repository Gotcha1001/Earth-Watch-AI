"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useDisasterEvents } from "@/hooks/useDisasterEvents";
import { useRegionRisk, useLatestAssessment } from "@/hooks/useRegionRisk";
import { useGlobalBriefing } from "@/hooks/useGlobalBriefing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import Link from "next/link";

const CATEGORY_LABEL: Record<Doc<"disasterEvents">["category"], string> = {
  earthquake: "🌐 Earthquake",
  wildfire: "🔥 Wildfire",
  flood: "🌊 Flood",
  storm: "🌀 Storm",
  volcano: "🌋 Volcano",
  severeWeather: "⛈️ Severe Weather",
};

// NOAA descriptions in particular can be a full paragraph — keep cards compact.
function truncate(text: string, max = 140): string {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function EventLocation({
  locationName,
}: {
  locationName?: string;
}): React.JSX.Element {
  return (
    <span className="text-xs text-gray-400">
      📍 {locationName ?? "Locating…"}
    </span>
  );
}

function RegionRiskCard({
  region,
}: {
  region: Doc<"watchedRegions">;
}): React.JSX.Element {
  const assessment = useLatestAssessment(region._id);
  return (
    <div className="rounded-lg border p-4 bg-white dark:bg-gray-900 dark:border-green-900/30">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-black dark:text-white">
          {region.name}
        </h3>
        {assessment && (
          <Badge
            className={
              assessment.riskLevel === "extreme"
                ? "bg-red-600"
                : assessment.riskLevel === "high"
                  ? "bg-orange-500"
                  : assessment.riskLevel === "moderate"
                    ? "bg-yellow-500"
                    : "bg-green-600"
            }
          >
            {assessment.riskLevel.toUpperCase()} · {assessment.riskScore}
          </Badge>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {assessment
          ? assessment.aiSummary
          : "No elevated risk detected right now."}
      </p>
    </div>
  );
}

function GlobalPriorityCard(): React.JSX.Element | null {
  const { briefing, isLoading } = useGlobalBriefing();
  if (isLoading)
    return <p className="text-sm text-gray-500">Loading global briefing...</p>;
  if (!briefing) return null;

  return (
    <div className="rounded-lg border p-4 bg-white dark:bg-gray-900 dark:border-green-900/30">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-black dark:text-white">
          Top Global Priority
        </h3>
        <Badge
          className={briefing.notifyRecommended ? "bg-red-600" : "bg-gray-500"}
        >
          {briefing.notifyRecommended ? "NOTIFY" : "MONITOR"}
        </Badge>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {briefing.aiSummary}
      </p>
      <div className="space-y-2">
        {briefing.topEvents.map((event) => (
          <Link
            key={event.eventId}
            href={`/dashboard/map?lat=${event.latitude}&lng=${event.longitude}&zoom=7&id=${event.eventId}`}
            className="block rounded-md px-2 py-1.5 -mx-2 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-black dark:text-white">
                {event.title}
              </span>
              <span className="text-gray-500">
                {event.rawSeverityLabel} · {event.hoursAgo}h ago
              </span>
            </div>
            <EventLocation locationName={event.locationName} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage(): React.JSX.Element {
  const { events, isLoading: eventsLoading } = useDisasterEvents();
  const { regions, isLoading: regionsLoading } = useRegionRisk();

  const clearAllEvents = useMutation(api.events.clearAllEvents);
  const manualIngest = useAction(api.eventsIngest.manualIngest);
  const [isResetting, setIsResetting] = useState(false);

  async function handleReset() {
    const confirmed = window.confirm(
      "This clears every currently-tracked global event (for all users) and immediately re-fetches from USGS/EONET/NOAA. Continue?",
    );
    if (!confirmed) return;
    setIsResetting(true);
    try {
      await clearAllEvents({});
      await manualIngest({});
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="p-6 space-y-8">
      <section>
        <h2 className="text-xl font-bold mb-3 text-black dark:text-white">
          Global Priority
        </h2>
        <GlobalPriorityCard />
      </section>

      <section>
        <h2 className="text-xl font-bold mb-3 text-black dark:text-white">
          Your Watched Regions
        </h2>
        {regionsLoading ? (
          <p className="text-sm text-gray-500">Loading regions...</p>
        ) : regions.length === 0 ? (
          <p className="text-sm text-gray-500">
            You aren&apos;t watching any regions yet. Add one from the Regions
            page.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regions.map((region) => (
              <RegionRiskCard key={region._id} region={region} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-black dark:text-white">
            Active Global Events
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isResetting}
            className="gap-1"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`}
            />
            {isResetting ? "Resetting..." : "Reset"}
          </Button>
        </div>
        {eventsLoading ? (
          <p className="text-sm text-gray-500">Loading live feeds...</p>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {events.map((event) => (
              <Link
                key={event._id}
                href={`/dashboard/map?lat=${event.latitude}&lng=${event.longitude}&zoom=8&id=${event._id}`}
                className="flex flex-col gap-1 rounded-md border p-3 dark:border-green-900/30 hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-black dark:text-white">
                    {event.title}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    {new Date(event.occurredAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {CATEGORY_LABEL[event.category]} · {event.rawSeverityLabel}
                </p>
                {event.description && (
                  <p className="text-xs text-gray-500 italic">
                    {truncate(event.description)}
                  </p>
                )}
                <EventLocation locationName={event.locationName} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
