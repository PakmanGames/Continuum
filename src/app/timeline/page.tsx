"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { cn } from "~/lib/cn";
import { Button, Card } from "../_components/ui";
import { PageTransition } from "../_components/page-transition";

/** Row shape from `GET /api/timeline`. */
type TimelineRow = {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: "error" | "deployment" | "incident";
  explanation: string;
  containerName: string;
};

const RANGES = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<number>(7);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/timeline");
      if (!response.ok) throw new Error("Failed to load the timeline");
      setEvents((await response.json()) as TimelineRow[]);
    } catch (err) {
      console.error("Timeline load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load timeline");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const cutoff = Date.now() - rangeDays * 86_400_000;
    return events
      .filter((e) => new Date(e.timestamp).getTime() >= cutoff)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }, [events, rangeDays]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-fg text-3xl font-semibold">
              Timeline
            </h1>
            <p className="text-muted mt-1 text-sm">
              Every incident the agents have reported, newest first.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              void load();
            }}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("mr-2 h-3.5 w-3.5", isRefreshing && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </header>

        {/* Range presets replace the old pair of datetime-local inputs, which
            rendered UTC into a control the browser reads as local time. */}
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((range) => (
            <button
              key={range.label}
              type="button"
              onClick={() => setRangeDays(range.days)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                rangeDays === range.days
                  ? "bg-accent text-accent-contrast"
                  : "border-border text-muted hover:bg-surface-2 hover:text-fg border",
              )}
            >
              {range.label}
            </button>
          ))}
          <span className="text-subtle ml-1 text-xs">
            {visible.length} event{visible.length === 1 ? "" : "s"}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="bg-surface-2 h-24 animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : error ? (
          <Card className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertTriangle className="text-danger h-8 w-8" aria-hidden="true" />
            <p className="text-fg font-medium">{error}</p>
          </Card>
        ) : visible.length === 0 ? (
          <Card className="py-16 text-center">
            <p className="text-fg text-sm font-medium">
              Nothing in the last {rangeDays === 1 ? "24 hours" : `${rangeDays} days`}
            </p>
            <p className="text-muted mt-1 text-sm">
              Widen the range, or enjoy the quiet.
            </p>
          </Card>
        ) : (
          <ol className="relative space-y-4">
            {/* Spine, tucked behind the markers. */}
            <span
              className="bg-border absolute top-2 bottom-2 left-[15px] w-px"
              aria-hidden="true"
            />

            {visible.map((event) => (
              <li key={event.id} className="relative flex gap-4">
                <span
                  className="bg-danger-soft ring-bg relative z-10 mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4"
                  aria-hidden="true"
                >
                  <AlertTriangle className="text-danger h-4 w-4" />
                </span>

                <Link href={`/error/${event.id}`} className="min-w-0 flex-1">
                  <Card className="hover:border-border-strong p-4 transition-colors">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-fg text-sm font-medium">
                        {event.containerName}
                      </h2>
                      <time
                        className="text-subtle font-mono text-xs"
                        dateTime={event.timestamp}
                      >
                        {new Date(event.timestamp).toLocaleString()}
                      </time>
                    </div>
                    <p className="text-muted mt-1.5 text-sm">{event.title}</p>
                    {event.explanation && (
                      <p className="text-subtle mt-2 border-l-2 border-border pl-3 text-xs">
                        {event.explanation}
                      </p>
                    )}
                  </Card>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </PageTransition>
  );
}
