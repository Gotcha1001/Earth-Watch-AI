// app/dashboard/alerts/page.tsx
"use client";
import { useAlerts } from "@/hooks/useAlerts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AlertsPage(): React.JSX.Element {
  const { alerts, acknowledge } = useAlerts();

  return (
    <div className="p-6 max-w-3xl space-y-3">
      <h2 className="text-xl font-bold text-black dark:text-white">Alert History</h2>
      {alerts.length === 0 && (
        <p className="text-sm text-gray-500">No alerts yet — that&apos;s good news.</p>
      )}
      {alerts.map((alert) => (
        <div
          key={alert._id}
          className={`rounded-lg border p-4 dark:border-green-900/30 ${
            alert.acknowledgedAt ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <Badge
              className={
                alert.riskLevel === "extreme"
                  ? "bg-red-600"
                  : alert.riskLevel === "high"
                    ? "bg-orange-500"
                    : "bg-yellow-500"
              }
            >
              {alert.riskLevel.toUpperCase()}
            </Badge>
            <span className="text-xs text-gray-400">
              {new Date(alert.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-black dark:text-white mb-2">{alert.message}</p>
          {!alert.acknowledgedAt && (
            <Button size="sm" variant="outline" onClick={() => acknowledge(alert._id)}>
              Acknowledge
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}