"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  Timer,
  TrendingUp,
} from "lucide-react";

import { cn } from "~/lib/cn";
import { relativeTime } from "~/lib/time";
import {
  STATUS_HEALTH,
  STATUS_LABEL,
  type ContainerStatus,
} from "~/lib/container-status";
import {
  Card,
  Pulse,
  StatTile,
  StatusPill,
} from "../_components/ui";
import { IncidentsChart } from "../_components/incidents-chart";
import { PageTransition } from "../_components/page-transition";
import { TrendGraph } from "../_components/trend-graph";

/**
 * How often the dashboard re-reads the API. The plan calls for polling rather
 * than the in-memory SSE emitter, which cannot fan out across Vercel's isolated
 * serverless instances (see docs/DEPLOYMENT.md §10).
 */
const POLL_MS = 5000;

/** Row shape from `GET /api/error`. Timestamps arrive as ISO strings. */
type IncidentRow = {
  id: number;
  containerId: number;
  serviceName: string;
  errorMessage: string;
  explaination: string;
  resolved: boolean;
  resolvedAt: string | null;
  occurredAt: string;
};

/** Row shape from `GET /api/servers`. */
type FleetServer = {
  id: string;
  name: string;
  status: ContainerStatus;
  cpu: number;
  memory: number;
  updatedAt: string;
};

/** Mean time to resolve, in minutes, over incidents that actually closed. */
function meanTimeToResolve(incidents: IncidentRow[]): number | null {
  const closed = incidents.filter((i) => i.resolved && i.resolvedAt);
  if (closed.length === 0) return null;

  const totalMs = closed.reduce(
    (sum, i) =>
      sum + (new Date(i.resolvedAt!).getTime() - new Date(i.occurredAt).getTime()),
    0,
  );
  return totalMs / closed.length / 60000;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export default function DashboardPage() {
  const [servers, setServers] = useState<FleetServer[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  /**
   * `quiet` keeps the skeleton from reappearing on every poll — only the first
   * load shows it, refreshes swap data underneath.
   */
  const load = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);
      setError(null);

      const [serversRes, errorsRes] = await Promise.all([
        fetch("/api/servers"),
        fetch("/api/error"),
      ]);
      if (!serversRes.ok) throw new Error("Failed to load the fleet");
      if (!errorsRes.ok) throw new Error("Failed to load incidents");

      setServers((await serversRes.json()) as FleetServer[]);
      setIncidents((await errorsRes.json()) as IncidentRow[]);
      setUpdatedAt(new Date());
    } catch (err) {
      console.error("Dashboard load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const running = servers.filter((s) => s.status === "running").length;
  const unhealthy = servers.length - running;
  const open = incidents.filter((i) => !i.resolved).length;
  const lastDay = incidents.filter(
    (i) => new Date(i.occurredAt).getTime() > Date.now() - 86_400_000,
  ).length;
  const mttr = meanTimeToResolve(incidents);

  const recent = [...incidents]
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, 5);

  const uptimeIncidents = incidents.map((i) => ({
    serverId: i.containerId.toString(),
    timestamp: i.occurredAt,
  }));

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-surface-2 h-9 w-48 animate-pulse rounded" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="bg-surface-2 h-28 animate-pulse rounded-xl"
            />
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="bg-surface-2 h-64 animate-pulse rounded-xl" />
          <div className="bg-surface-2 h-64 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="flex flex-col items-center gap-4 py-16 text-center">
          <AlertTriangle className="text-danger h-8 w-8" aria-hidden="true" />
          <div>
            <p className="text-fg font-medium">{error}</p>
            <p className="text-muted mt-1 text-sm">
              The dashboard retries automatically every few seconds.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-fg text-3xl font-semibold">
              Dashboard
            </h1>
            <p className="text-muted mt-1 text-sm">
              {open > 0
                ? `${open} incident${open === 1 ? "" : "s"} open across ${servers.length} containers.`
                : `All quiet across ${servers.length} containers.`}
            </p>
          </div>
          <div className="text-subtle flex items-center gap-2 text-xs">
            <Pulse tone="success" />
            Live
            {updatedAt && (
              <span className="text-subtle">
                · updated {updatedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Running"
            value={running}
            unit={`/ ${servers.length}`}
            icon={Boxes}
            delta={unhealthy > 0 ? `${unhealthy} not healthy` : "all healthy"}
            deltaDirection={unhealthy > 0 ? "down" : "up"}
          />
          <StatTile
            label="Open incidents"
            value={open}
            icon={AlertTriangle}
            delta={`${incidents.length} all time`}
          />
          <StatTile
            label="Mean time to resolve"
            value={mttr === null ? "—" : formatDuration(mttr)}
            icon={Timer}
            delta={mttr === null ? "nothing resolved yet" : "across resolved"}
          />
          <StatTile
            label="Last 24 hours"
            value={lastDay}
            icon={TrendingUp}
            delta={lastDay === 0 ? "no new incidents" : "new incidents"}
            deltaDirection={lastDay === 0 ? "up" : "down"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <IncidentsChart timestamps={incidents.map((i) => new Date(i.occurredAt))} />
          <TrendGraph incidents={uptimeIncidents} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-border flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-display text-fg text-sm font-semibold">
                Recent incidents
              </h2>
            </div>
            {recent.length === 0 ? (
              <p className="text-muted px-5 py-12 text-center text-sm">
                No incidents recorded yet.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {recent.map((incident) => (
                  <li key={incident.id}>
                    <Link
                      href={`/error/${incident.id}`}
                      className="hover:bg-surface-2 flex items-start gap-3 px-5 py-4 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-fg text-sm font-medium">
                            {incident.serviceName}
                          </span>
                          <StatusPill
                            status={incident.resolved ? "resolved" : "down"}
                            label={incident.resolved ? "Resolved" : "Active"}
                          />
                        </div>
                        <p className="text-muted mt-1 truncate text-sm">
                          {incident.explaination}
                        </p>
                        <p className="text-subtle mt-1 text-xs">
                          {relativeTime(incident.occurredAt)}
                        </p>
                      </div>
                      <ChevronRight
                        className="text-subtle mt-1 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-border flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-display text-fg text-sm font-semibold">
                Fleet
              </h2>
              <Link
                href="/servers"
                className="text-accent hover:text-accent-strong text-sm font-medium transition-colors"
              >
                View all
              </Link>
            </div>
            {servers.length === 0 ? (
              <p className="text-muted px-5 py-12 text-center text-sm">
                No containers reporting yet.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {servers.slice(0, 5).map((server) => (
                  <li
                    key={server.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-fg text-sm font-medium">
                          {server.name}
                        </span>
                        <StatusPill
                          status={STATUS_HEALTH[server.status]}
                          label={STATUS_LABEL[server.status]}
                        />
                      </div>
                      <p className="text-subtle mt-1 font-mono text-xs tabular-nums">
                        {server.status === "running"
                          ? `cpu ${server.cpu.toFixed(1)}% · mem ${server.memory.toFixed(1)}%`
                          : `last seen ${relativeTime(server.updatedAt)}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "h-8 w-1 shrink-0 rounded-full",
                        STATUS_HEALTH[server.status] === "healthy"
                          ? "bg-success"
                          : STATUS_HEALTH[server.status] === "down"
                            ? "bg-danger"
                            : "bg-border",
                      )}
                      aria-hidden="true"
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
