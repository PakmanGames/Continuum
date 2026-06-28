"use client";

import { useMemo, useState } from "react";

import { ChartFrame } from "./ui/chart-frame";

type IncidentsChartProps = {
  /** When each incident occurred. Anything older than the window is ignored. */
  timestamps: Date[];
  days?: number;
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/**
 * Incident volume per day. One series, so no legend — the title names it, and
 * the y-axis is labelled only at its maximum to keep the grid recessive.
 *
 * Deliberately hand-rolled rather than pulling in a charting library: a single
 * bar series over a fixed window is a flex row, and the dependency would weigh
 * more than the code it replaces.
 */
export function IncidentsChart({ timestamps, days = 30 }: IncidentsChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const buckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ts of timestamps) {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      const key = dayKey(d);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: days }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1 - i));
      return { date, count: counts.get(dayKey(date)) ?? 0 };
    });
  }, [timestamps, days]);

  const peak = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const active = hovered === null ? null : buckets[hovered];

  return (
    <ChartFrame
      title="Incidents over time"
      description={`${total} in the last ${days} days`}
    >
      <div className="px-2">
        {/* Peak gridline — the only y-reference, so the grid stays quiet. */}
        <div className="text-subtle mb-1 flex items-center gap-2 font-mono text-[10px]">
          <span className="tabular-nums">{peak}</span>
          <span className="bg-border h-px flex-1" />
        </div>

        <div
          className="relative flex h-32 items-end gap-[2px]"
          onMouseLeave={() => setHovered(null)}
        >
          {buckets.map((bucket, i) => {
            const label = `${bucket.date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}: ${bucket.count} incident${bucket.count === 1 ? "" : "s"}`;

            return (
              <div
                key={dayKey(bucket.date)}
                className="group flex h-full min-w-0 flex-1 cursor-default items-end"
                onMouseEnter={() => setHovered(i)}
                title={label}
                aria-label={label}
              >
                <div
                  className={
                    bucket.count === 0
                      ? "bg-border h-px w-full rounded-full"
                      : "bg-accent group-hover:bg-accent-strong w-full rounded-t-[4px] transition-colors"
                  }
                  style={
                    bucket.count === 0
                      ? undefined
                      : { height: `${(bucket.count / peak) * 100}%` }
                  }
                />
              </div>
            );
          })}

          {active && (
            <div className="border-border bg-elevated pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-md border px-2.5 py-1.5 shadow-lg">
              <p className="text-fg font-mono text-xs whitespace-nowrap tabular-nums">
                {active.count} incident{active.count === 1 ? "" : "s"}
              </p>
              <p className="text-muted text-[10px] whitespace-nowrap">
                {active.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

        <div className="text-subtle mt-2 flex justify-between text-[10px]">
          <span>{days} days ago</span>
          <span>Today</span>
        </div>
      </div>
    </ChartFrame>
  );
}
