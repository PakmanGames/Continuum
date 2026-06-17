"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Server as ServerIcon } from "lucide-react";

import { cn } from "~/lib/cn";
import {
  Button,
  Card,
  StatTile,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  type Status,
} from "../_components/ui";
import { PageTransition } from "../_components/page-transition";

/** Shape returned by `GET /api/servers`. Timestamps arrive as ISO strings. */
type FleetServer = {
  id: string;
  name: string;
  status: "running" | "stopped" | "crashed";
  cpu: number;
  memory: number;
  updatedAt: string;
};

/** Container state maps onto the shared health vocabulary of StatusPill. */
const STATUS_PILL: Record<FleetServer["status"], Status> = {
  running: "healthy",
  crashed: "down",
  stopped: "unknown",
};

const STATUS_LABEL: Record<FleetServer["status"], string> = {
  running: "Running",
  crashed: "Crashed",
  stopped: "Stopped",
};

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Horizontal usage meter. Colour crosses into warning at 60% and danger at 80%,
 * matching the thresholds an operator would set an alert on.
 */
function UsageMeter({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex items-center gap-3">
      <div className="bg-surface-2 h-1.5 w-20 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            pct > 80 ? "bg-danger" : pct > 60 ? "bg-warning" : "bg-success",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-muted w-12 font-mono text-xs tabular-nums">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

export default function ServersPage() {
  const [servers, setServers] = useState<FleetServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/servers");
      if (!response.ok) throw new Error("Failed to fetch servers");
      setServers((await response.json()) as FleetServer[]);
    } catch (err) {
      console.error("Error fetching servers:", err);
      setError(err instanceof Error ? err.message : "Failed to load servers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchServers();
  }, [fetchServers]);

  const handleRefresh = async () => {
    setBusyId("__refresh");
    try {
      const response = await fetch("/api/servers/refresh", { method: "POST" });
      if (!response.ok) throw new Error("Failed to refresh servers");
      await fetchServers();
      setNotice("Fleet refreshed");
    } catch (err) {
      console.error("Error refreshing servers:", err);
      setNotice("Could not refresh the fleet");
    } finally {
      setBusyId(null);
    }
  };

  const handleReset = async (server: FleetServer) => {
    setBusyId(server.id);
    try {
      const response = await fetch(`/api/servers/${server.id}/reset`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to reset server");
      await fetchServers();
      setNotice(`${server.name} reset`);
    } catch (err) {
      console.error("Error resetting server:", err);
      setNotice(`Could not reset ${server.name}`);
    } finally {
      setBusyId(null);
    }
  };

  const running = servers.filter((s) => s.status === "running");
  const unhealthy = servers.filter((s) => s.status !== "running");
  const averageCpu = running.length
    ? running.reduce((sum, s) => sum + s.cpu, 0) / running.length
    : 0;

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-fg text-3xl font-semibold">
              Fleet
            </h1>
            <p className="text-muted mt-1 text-sm">
              Every container reporting to Continiuum, and what its agent last
              saw.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {notice && (
              <span className="text-subtle text-xs" role="status">
                {notice}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={busyId !== null}
            >
              <RefreshCw
                className={cn(
                  "mr-2 h-3.5 w-3.5",
                  busyId === "__refresh" && "animate-spin",
                )}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        </header>

        {!isLoading && !error && servers.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Containers"
              value={servers.length}
              icon={ServerIcon}
            />
            <StatTile
              label="Running"
              value={running.length}
              delta={
                unhealthy.length > 0
                  ? `${unhealthy.length} not healthy`
                  : "all healthy"
              }
              deltaDirection={unhealthy.length > 0 ? "down" : "up"}
            />
            <StatTile
              label="Avg CPU"
              value={averageCpu.toFixed(1)}
              unit="%"
            />
          </div>
        )}

        <Card className="overflow-hidden">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Container</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>CPU</TableHeaderCell>
                <TableHeaderCell>Memory</TableHeaderCell>
                <TableHeaderCell>Last check-in</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  Actions
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {isLoading &&
                // Skeleton rows keep the table height stable while loading, so
                // the page does not jump when real rows arrive.
                Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell colSpan={6}>
                      <div className="bg-surface-2 h-5 w-full animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && error && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p className="text-danger text-sm">{error}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4"
                      onClick={() => void fetchServers()}
                    >
                      Try again
                    </Button>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !error && servers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p className="text-fg text-sm font-medium">
                      No containers yet
                    </p>
                    <p className="text-muted mx-auto mt-1 max-w-sm text-sm">
                      Point an agent at this deployment with{" "}
                      <code className="text-accent font-mono text-xs">
                        AGENT_BACKEND_URL
                      </code>{" "}
                      and its containers will appear here.
                    </p>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                !error &&
                servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {server.name}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        status={STATUS_PILL[server.status]}
                        label={STATUS_LABEL[server.status]}
                      />
                    </TableCell>
                    <TableCell>
                      <UsageMeter value={server.cpu} />
                    </TableCell>
                    <TableCell>
                      <UsageMeter value={server.memory} />
                    </TableCell>
                    <TableCell className="text-muted whitespace-nowrap">
                      {relativeTime(server.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleReset(server)}
                        disabled={busyId !== null}
                      >
                        {busyId === server.id ? "Resetting…" : "Reset"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PageTransition>
  );
}
