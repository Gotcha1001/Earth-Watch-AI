// app/dashboard/page.tsx
"use client";
import { useDisasterEvents } from "@/hooks/useDisasterEvents";
import { useRegionRisk, useLatestAssessment } from "@/hooks/useRegionRisk";
import { Badge } from "@/components/ui/badge";
import type { Doc } from "@/convex/_generated/dataModel";

const CATEGORY_LABEL: Record<Doc<"disasterEvents">["category"], string> = {
  earthquake: "🌐 Earthquake",
  wildfire: "🔥 Wildfire",
  flood: "🌊 Flood",
  storm: "🌀 Storm",
  volcano: "🌋 Volcano",
  severeWeather: "⛈️ Severe Weather",
};

function RegionRiskCard({ region }: { region: Doc<"watchedRegions"> }): React.JSX.Element {
  const assessment = useLatestAssessment(region._id);

  return (
    <div className="rounded-lg border p-4 bg-white dark:bg-gray-900 dark:border-green-900/30">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-black dark:text-white">{region.name}</h3>
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
        {assessment ? assessment.aiSummary : "No elevated risk detected right now."}
      </p>
    </div>
  );
}

export default function DashboardPage(): React.JSX.Element {
  const { events, isLoading: eventsLoading } = useDisasterEvents();
  const { regions, isLoading: regionsLoading } = useRegionRisk();

  return (
    <div className="p-6 space-y-8">
      <section>
        <h2 className="text-xl font-bold mb-3 text-black dark:text-white">Your Watched Regions</h2>
        {regionsLoading ? (
          <p className="text-sm text-gray-500">Loading regions…</p>
        ) : regions.length === 0 ? (
          <p className="text-sm text-gray-500">
            You aren&apos;t watching any regions yet. Add one from the Regions page.
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
        <h2 className="text-xl font-bold mb-3 text-black dark:text-white">Active Global Events</h2>
        {eventsLoading ? (
          <p className="text-sm text-gray-500">Loading live feeds…</p>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {events.map((event) => (
              <div
                key={event._id}
                className="flex items-center justify-between rounded-md border p-3 dark:border-green-900/30"
              >
                <div>
                  <p className="font-medium text-sm text-black dark:text-white">{event.title}</p>
                  <p className="text-xs text-gray-500">
                    {CATEGORY_LABEL[event.category]} · {event.rawSeverityLabel}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(event.occurredAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}