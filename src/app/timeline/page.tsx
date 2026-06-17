"use client";

import { useState, useMemo, useEffect } from "react";
import { type TimelineEvent } from "~/lib/mock-data";
import { PageTransition } from "../_components/page-transition";

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    end: new Date(),
  });

  const fetchTimeline = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/timeline");
      if (!response.ok) throw new Error("Failed to fetch timeline");

      const timelineData = await response.json();

      // Transform API data to TimelineEvent format
      const transformedEvents: TimelineEvent[] = timelineData.map((event: any) => ({
        id: event.id,
        timestamp: new Date(event.timestamp),
        title: event.title,
        description: event.description,
        type: event.type as "error" | "deployment" | "incident",
      }));

      setEvents(transformedEvents);
    } catch (err) {
      console.error("Error fetching timeline:", err);
      setError(err instanceof Error ? err.message : "Failed to load timeline");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, []);

  // Filter events by time range
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const eventTime = event.timestamp.getTime();
      return (
        eventTime >= timeRange.start.getTime() &&
        eventTime <= timeRange.end.getTime()
      );
    });
  }, [events, timeRange]);

  // Group events by date for the horizontal timeline
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, TimelineEvent[]>();
    filteredEvents.forEach((event) => {
      const dateKey = event.timestamp.toDateString();
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    });
    return grouped;
  }, [filteredEvents]);

  // Get all unique dates for scrubbing
  const allDates = useMemo(() => {
    const dates = Array.from(eventsByDate.keys())
      .map((dateStr) => new Date(dateStr))
      .sort((a, b) => b.getTime() - a.getTime());
    return dates;
  }, [eventsByDate]);

  const handleRefresh = async () => {
    await fetchTimeline();
  };

  const getEventIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "error":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--danger)]/50 bg-gradient-to-br from-[var(--danger)]/30 to-[var(--danger)]/30 shadow-lg">
            <svg
              className="h-5 w-5 text-[var(--danger)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        );
      case "deployment":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--accent)]/50 bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent-strong)]/30 shadow-lg">
            <svg
              className="h-5 w-5 text-[var(--accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
        );
      case "incident":
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--success)]/50 bg-gradient-to-br from-[var(--success)]/30 to-[var(--success)]/30 shadow-lg">
            <svg
              className="h-5 w-5 text-[var(--success)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--border)] shadow-lg">
            <svg
              className="h-5 w-5 text-[var(--fg)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <p className="text-[var(--muted)]">Loading timeline...</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <p className="text-[var(--danger)]">Error: {error}</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pt-6">
          <h1 className="text-3xl font-bold text-[var(--fg)]">Timeline</h1>
          <button
            onClick={handleRefresh}
            className="rounded-lg bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/20"
          >
            Refresh
          </button>
        </div>

        {/* Time Range Controls */}
        <div className="card p-6">
          <h2 className="mb-4 text-sm font-medium text-[var(--fg)]">
            Time Range
          </h2>
          <div className="flex items-center space-x-4">
            <input
              type="datetime-local"
              value={timeRange.start.toISOString().slice(0, 16)}
              onChange={(e) =>
                setTimeRange({ ...timeRange, start: new Date(e.target.value) })
              }
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none"
            />
            <span className="text-[var(--muted)]">to</span>
            <input
              type="datetime-local"
              value={timeRange.end.toISOString().slice(0, 16)}
              onChange={(e) =>
                setTimeRange({ ...timeRange, end: new Date(e.target.value) })
              }
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none"
            />
            <button
              onClick={() => {
                setTimeRange({
                  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  end: new Date(),
                });
                setSelectedDate(null);
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--border)]"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Horizontal Timeline */}
        <div className="card p-6">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-12 bottom-12 w-0.5 bg-gradient-to-b from-[var(--accent)] via-[var(--accent-strong)] to-[var(--success)] opacity-50"></div>

            {/* Timeline events */}
            <div className="space-y-8">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[var(--muted)]">
                    No events found in the selected time range
                  </p>
                </div>
              ) : (
                filteredEvents
                  .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                  .map((event, index) => (
                    <div key={event.id} className="relative flex items-start space-x-6">
                      {/* Timeline node */}
                      <div className="relative z-10 flex-shrink-0">
                        {getEventIcon(event.type)}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 min-w-0 pb-8">
                        <div className="group relative">
                          {/* Event card */}
                          <div className="card p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/10">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <h3 className="text-sm font-semibold text-[var(--fg)]">
                                    {event.title}
                                  </h3>
                                  <span className="text-xs text-[var(--muted)]">
                                    {event.timestamp.toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-sm text-[var(--fg)] line-clamp-2">
                                  {event.description}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Hover tooltip */}
                          <div className="absolute left-full top-0 ml-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl p-4 w-96 max-w-sm">
                              <div className="space-y-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-[var(--fg)] mb-1">
                                    {event.type === "error" ? "Error Message" : event.type === "deployment" ? "Deployment" : "Event"}
                                  </h4>
                                  <p className="text-xs text-[var(--fg)] leading-relaxed">
                                    {event.description}
                                  </p>
                                </div>
                                <div className="pt-2 border-t border-[var(--border)]">
                                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                                    <span>{event.timestamp.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>
                              {/* Arrow pointing to the event */}
                              <div className="absolute right-full top-4 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-[var(--surface)]"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
