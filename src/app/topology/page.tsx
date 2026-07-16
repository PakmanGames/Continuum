"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, Radar } from "lucide-react";

import { relativeTime } from "~/lib/time";
import type { Topology, TopologyNode } from "~/lib/topology";
import { Card, Pulse, StatusPill } from "../_components/ui";
import { PageTransition } from "../_components/page-transition";
import { TopologyGraph } from "../_components/topology-graph";
import { ChaosPanel } from "../_components/chaos-panel";

/** Tight enough to feel live; the graph is small and the query is three reads. */
const POLL_MS = 2000;

export default function TopologyPage() {
  const [topology, setTopology] = useState<Topology | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/topology");
      if (!response.ok) throw new Error("Failed to load the topology");
      setTopology((await response.json()) as Topology);
      setError(null);
    } catch (err) {
      console.error("Topology load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load topology");
    }
  }, []);

  useEffect(() => {
    void load();
    // Skip ticks while the tab is hidden — nobody is watching the graph move.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const byId = useMemo(
    () => new Map(topology?.nodes.map((n) => [n.id, n]) ?? []),
    [topology],
  );

  const activeId = hovered ?? selected;
  const active = activeId ? (byId.get(activeId) ?? null) : null;

  const services = topology?.nodes.filter((n) => n.kind === "service") ?? [];
  const agentCount = topology?.nodes.filter((n) => n.kind === "agent").length ?? 0;
  // The simulated demo writes fake rows, so it only ever targets the seeded
  // fleet; live containers get real commands (Live mode, M3).
  const healthyServices = services
    .filter((s) => s.status === "running" && s.source === "seed")
    .map((s) => ({ id: s.id, name: s.name }));
  const unhealthy =
    topology?.nodes.filter((n) => n.health !== "healthy").length ?? 0;

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-fg text-3xl font-semibold">
              Topology
            </h1>
            <p className="text-muted mt-1 text-sm">
              Real agents watch the containers they registered; the seeded demo
              fleet has a derived agent each, wired into a ring so none goes
              unobserved.
            </p>
          </div>
          {topology && (
            <div className="text-subtle flex items-center gap-2 font-mono text-xs">
              <Pulse tone={unhealthy > 0 ? "warning" : "success"} />
              {services.length} services · {agentCount} agents ·{" "}
              {topology.edges.length} links
              <span className="text-subtle">
                · {new Date(topology.generatedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </header>

        {error && !topology ? (
          <Card className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertTriangle className="text-danger h-8 w-8" aria-hidden="true" />
            <div>
              <p className="text-fg font-medium">{error}</p>
              <p className="text-muted mt-1 text-sm">
                Retrying every {POLL_MS / 1000}s.
              </p>
            </div>
          </Card>
        ) : !topology ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="bg-surface-2 aspect-square w-full max-w-[520px] animate-pulse justify-self-center rounded-xl" />
            <div className="bg-surface-2 h-64 animate-pulse rounded-xl" />
          </div>
        ) : services.length === 0 ? (
          <Card className="py-16 text-center">
            <Radar
              className="text-subtle mx-auto h-8 w-8"
              aria-hidden="true"
            />
            <p className="text-fg mt-4 text-sm font-medium">
              No containers reporting yet
            </p>
            <p className="text-muted mx-auto mt-1 max-w-sm text-sm">
              Point an agent at this deployment with{" "}
              <code className="text-accent font-mono text-xs">
                AGENT_BACKEND_URL
              </code>{" "}
              and the mesh will draw itself.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="p-4 sm:p-6">
              <TopologyGraph
                topology={topology}
                activeId={activeId}
                onHover={setHovered}
                onSelect={(id) =>
                  setSelected((current) => (current === id ? null : id))
                }
              />
            </Card>

            <div className="space-y-4">
              <NodeDetails
                node={active}
                byId={byId}
                pinned={selected !== null && hovered === null}
              />
              <ChaosPanel
                services={healthyServices}
                onFocus={(id) => {
                  setHovered(null);
                  setSelected(id);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function NodeDetails({
  node,
  byId,
  pinned,
}: {
  node: TopologyNode | null;
  byId: Map<string, TopologyNode>;
  pinned: boolean;
}) {
  if (!node) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Eye className="text-subtle h-6 w-6" aria-hidden="true" />
        <p className="text-muted text-sm">
          Hover a node to inspect it, or click to pin.
        </p>
      </Card>
    );
  }

  const name = (id: string) => byId.get(id)?.name ?? id;
  const watchedBy = [...byId.values()].filter((n) =>
    n.watches.includes(node.id),
  );

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-subtle text-xs font-medium tracking-wide uppercase">
            {node.kind}
            {node.source === "seed" && " · demo"}
            {pinned && " · pinned"}
          </p>
          <h2 className="text-fg mt-1 truncate font-mono text-lg font-semibold">
            {node.name}
          </h2>
        </div>
        <StatusPill status={node.health} />
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <Row label="Last check-in">
          {node.lastSeen ? relativeTime(node.lastSeen) : "never"}
        </Row>

        {node.kind === "service" && (
          <>
            <Row label="Status">
              <span className="font-mono">{node.status}</span>
            </Row>
            <Row label="Open incidents">
              {node.openIncidents ? (
                <Link
                  href="/timeline"
                  className="text-accent hover:text-accent-strong transition-colors"
                >
                  {node.openIncidents}
                </Link>
              ) : (
                "0"
              )}
            </Row>
            {node.cpu !== undefined && node.memory !== undefined && (
              <Row label="Usage">
                <span className="font-mono tabular-nums">
                  cpu {node.cpu.toFixed(1)}% · mem {node.memory.toFixed(1)}%
                </span>
              </Row>
            )}
          </>
        )}

        {node.watches.length > 0 && (
          <Row label="Watches">
            <span className="font-mono">
              {node.watches.map(name).join(", ")}
            </span>
          </Row>
        )}
        {watchedBy.length > 0 && (
          <Row label="Watched by">
            <span className="font-mono">
              {watchedBy.map((n) => n.name).join(", ")}
            </span>
          </Row>
        )}
      </dl>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-subtle shrink-0 text-xs">{label}</dt>
      <dd className="text-fg text-right">{children}</dd>
    </div>
  );
}
