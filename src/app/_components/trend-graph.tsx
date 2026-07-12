"use client";

import { cn } from "~/lib/cn";
import { ChartFrame } from "./ui/chart-frame";

/** Only the two fields this chart actually reads. */
type UptimeIncident = {
  serverId: string;
  timestamp: Date | string;
};

type TrendGraphProps = {
  incidents: UptimeIncident[];
  days?: number;
  /**
   * Optional: show uptime for a single server.
   * If omitted, this shows "global" platform uptime.
   */
  serverId?: string;
};

export function TrendGraph({
  incidents,
  days = 90,
  serverId,
}: TrendGraphProps) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const today = new Date();

  // Normalize a Date to "YYYY-MM-DD"
  const toDayKey = (date: Date) => date.toISOString().slice(0, 10);

  // Optionally filter incidents to a single server
  const filteredIncidents = serverId
    ? incidents.filter((i) => i.serverId === serverId)
    : incidents;

  // Build a set of "days that had at least one incident"
  const incidentDays = new Set<string>();
  for (const inc of filteredIncidents) {
    const ts =
      inc.timestamp instanceof Date ? inc.timestamp : new Date(inc.timestamp);
    const key = toDayKey(ts);
    incidentDays.add(key);
  }

  // Build the last N days as buckets
  type DayBucket = { date: Date; key: string; hasIncident: boolean };

  const dayBuckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * MS_PER_DAY);
    const key = toDayKey(date);

    dayBuckets.push({
      date,
      key,
      hasIncident: incidentDays.has(key),
    });
  }

  const daysWithIncident = dayBuckets.filter((d) => d.hasIncident).length;
  const daysWithoutIncident = dayBuckets.length - daysWithIncident;

  const uptimePercent =
    dayBuckets.length === 0
      ? 100
      : (daysWithoutIncident / dayBuckets.length) * 100;

  return (
    <ChartFrame
      title="Uptime"
      description={`${uptimePercent.toFixed(2)}% over the last ${days} days`}
      actions={
        <div className="text-subtle flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="bg-success h-2 w-2 rounded-full" />
            Operational
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-danger h-2 w-2 rounded-full" />
            Incident
          </span>
        </div>
      }
    >
      <div className="px-2">
        {serverId && (
          <p className="text-subtle mb-2 text-[11px]">
            Filtered to <span className="text-fg font-mono">{serverId}</span>
          </p>
        )}

        <div className="flex h-32 items-end gap-[2px]">
          {dayBuckets.map((day) => (
            <div
              key={day.key}
              className={cn(
                "h-full min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-60",
                day.hasIncident ? "bg-danger" : "bg-success",
              )}
              title={`${day.date.toDateString()} • ${
                day.hasIncident ? "Incident" : "Operational"
              }`}
            />
          ))}
        </div>

        <div className="text-subtle mt-2 flex justify-between text-[10px]">
          <span>{days} days ago</span>
          <span>Today</span>
        </div>
      </div>
    </ChartFrame>
  );
}
