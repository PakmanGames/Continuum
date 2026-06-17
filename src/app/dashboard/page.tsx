"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import type { Server, Incident } from "~/lib/mock-data";
import { PageTransition } from "../_components/page-transition";
import { TrendGraph } from "~/app/_components/trend-graph";
import { IncidentTimeline } from "~/app/_components/incident-timeline";
import { useDataUpdates } from "~/hooks/use-data-updates";

export default function DashboardPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch servers
      const serversRes = await fetch("/api/servers");
      if (!serversRes.ok) throw new Error("Failed to fetch servers");
      const serversData = await serversRes.json();
      setServers(serversData);

      // Fetch errors/incidents
      try {
        const errorsRes = await fetch("/api/error");
        if (!errorsRes.ok) {
          const errorData = await errorsRes.json().catch(() => ({}));
          console.error("Error API response:", errorsRes.status, errorData);
          throw new Error(
            `Failed to fetch errors: ${errorsRes.status} ${errorData.error || ""}`,
          );
        }
        const errorsData = await errorsRes.json();

        // Transform errors to incidents format (matching database schema)
        const incidentsData: Incident[] = errorsData.map((error: any) => ({
          id: error.id?.toString() ?? "unknown",
          serverId: error.containerId?.toString() ?? "unknown",
          serverName: error.serviceName ?? "Unknown server",
          timestamp: new Date(error.occurredAt),
          logs: error.errorMessage ?? "",
          aiSummary: error.explaination ?? "",
          aiFix: error.suggestedFix ?? "",
          resolved: error.resolved ?? false,
        }));

        setIncidents(incidentsData);
      } catch (errorErr) {
        console.error("Error fetching incidents:", errorErr);
        // Set empty array instead of breaking the whole page
        setIncidents([]);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle real-time updates
  const handleUpdate = useCallback(() => {
    console.log("🔔 Real-time update triggered!");
    setLastUpdate(new Date());
    fetchData();
  }, [fetchData]);

  // Listen for real-time updates
  const { isConnected } = useDataUpdates(handleUpdate);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch servers
        const serversRes = await fetch("/api/servers");
        if (!serversRes.ok) throw new Error("Failed to fetch servers");
        const serversData = await serversRes.json();
        setServers(serversData);

        // Fetch errors/incidents
        try {
          const errorsRes = await fetch("/api/error");
          if (!errorsRes.ok) {
            const errorData = await errorsRes.json().catch(() => ({}));
            console.error("Error API response:", errorsRes.status, errorData);
            throw new Error(
              `Failed to fetch errors: ${errorsRes.status} ${errorData.error || ""}`,
            );
          }
          const errorsData = await errorsRes.json();

          // Transform errors to incidents format (matching database schema)
          const incidentsData: Incident[] = errorsData.map((error: any) => ({
            id: error.id?.toString() ?? "unknown",
            serverId: error.containerId?.toString() ?? "unknown",
            serverName: error.serviceName ?? "Unknown server",
            timestamp: new Date(error.occurredAt),
            logs: error.errorMessage ?? "",
            aiSummary: error.explaination ?? "",
            aiFix: error.suggestedFix ?? "",
            resolved: error.resolved ?? false,
          }));

          setIncidents(incidentsData);
        } catch (errorErr) {
          console.error("Error fetching incidents:", errorErr);
          // Set empty array instead of breaking the whole page
          setIncidents([]);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [fetchData]);

  const activeServers = servers.filter((s) => s.status === "running").length;
  const crashedServers = servers.filter((s) => s.status === "crashed").length;
  const unresolvedIncidents = incidents.filter((i) => !i.resolved).length;
  const errorsToday = incidents.filter(
    (i) => i.timestamp.getTime() > Date.now() - 86400000,
  ).length;

  const recentIncidents = [...incidents]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="mx-52 flex items-center justify-center py-12">
        <p className="text-[var(--muted)]">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-52 flex items-center justify-center py-12">
        <p className="text-[var(--danger)]">Error: {error}</p>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="mx-52 space-y-6">
        <div className="flex items-center justify-between pt-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-[var(--fg)]">Dashboard</h1>
            {isConnected && (
              <div className="flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--success)]" />
                <span className="text-[var(--muted)]">Live</span>
              </div>
            )}
            {lastUpdate && (
              <span className="text-xs text-[var(--muted)]">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <TrendGraph incidents={incidents} />

        {/* NEW: Timeline Section */}
        <IncidentTimeline incidents={incidents} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-strong)]/20">
              <svg
                className="h-6 w-6 text-[var(--accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--muted)]">
                Active Agents
              </p>
              <p className="text-2xl font-semibold text-[var(--fg)]">
                {activeServers}
              </p>
            </div>
          </div>

          <div className="card flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--danger)]/30 bg-gradient-to-br from-[var(--danger)]/20 to-[var(--danger)]/20">
              <svg
                className="h-6 w-6 text-[var(--danger)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--muted)]">
                Crashed Servers
              </p>
              <p className="text-2xl font-semibold text-[var(--fg)]">
                {crashedServers}
              </p>
            </div>
          </div>

          <div className="card flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--warning)]/30 bg-gradient-to-br from-[var(--warning)]/20 to-[var(--warning)]/20">
              <svg
                className="h-6 w-6 text-[var(--warning)]"
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
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--muted)]">
                Unresolved Incidents
              </p>
              <p className="text-2xl font-semibold text-[var(--fg)]">
                {unresolvedIncidents}
              </p>
            </div>
          </div>

          <div className="card flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--border)] bg-gradient-to-br from-[var(--border)]/50 to-[var(--surface-2)]/50">
              <svg
                className="h-6 w-6 text-[var(--fg)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--muted)]">Errors Today</p>
              <p className="text-2xl font-semibold text-[var(--fg)]">
                {errorsToday}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="card">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-lg font-semibold text-[var(--fg)]">
              Recent Incidents
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recentIncidents.length === 0 ? (
              <div className="px-6 py-8 text-center text-[var(--muted)]">
                No incidents found
              </div>
            ) : (
              recentIncidents.map((incident) => (
                <Link
                  key={incident.id}
                  href={`/error/${incident.id}`}
                  className="block px-6 py-4 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-[var(--fg)]">
                          {incident.serverName}
                        </p>
                        {!incident.resolved && (
                          <span className="badge-error inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                            Active
                          </span>
                        )}
                        {incident.resolved && (
                          <span className="badge-success inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                            Resolved
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--fg)]">
                        {incident.aiSummary}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {incident.timestamp.toLocaleString()}
                      </p>
                    </div>
                    <svg
                      className="h-5 w-5 text-[var(--muted)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Active Servers Preview */}
        <div className="card">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--fg)]">
                Active Agents
              </h2>
              <Link
                href="/servers"
                className="text-sm font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]"
              >
                View all →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {servers.slice(0, 5).map((server) => (
              <div key={server.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-[var(--fg)]">
                        {server.name}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          server.status === "running"
                            ? "badge-success"
                            : server.status === "crashed"
                              ? "badge-error"
                              : "border border-[var(--border)] bg-[var(--border)] text-[var(--fg)]"
                        }`}
                      >
                        {server.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-[var(--muted)]">
                      <span>CPU: {server.cpu.toFixed(1)}%</span>
                      <span>Memory: {server.memory.toFixed(1)}%</span>
                    </div>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const response = await fetch(
                          `/api/servers/${server.id}/reset`,
                          {
                            method: "POST",
                          },
                        );
                        if (!response.ok)
                          throw new Error("Failed to reset server");
                        // Refresh servers list
                        const serversRes = await fetch("/api/servers");
                        const serversData = await serversRes.json();
                        setServers(serversData);
                      } catch (err) {
                        console.error("Error resetting server:", err);
                        alert(`Failed to reset ${server.name}`);
                      }
                    }}
                    className="rounded-lg bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] px-3 py-1.5 text-xs font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/20"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
