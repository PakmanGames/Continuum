"use client";

import { cn } from "~/lib/cn";
import type { NodeHealth, Topology } from "~/lib/topology";

const SIZE = 600;
const CENTER = SIZE / 2;

/** Agents sit on an inner ring, each service directly outside its agent. */
const AGENT_RING = 150;
const SERVICE_RING = 245;
const RADIUS = { service: 22, agent: 14 } as const;

const STROKE: Record<NodeHealth, string> = {
  healthy: "stroke-success",
  degraded: "stroke-warning",
  down: "stroke-danger",
  unknown: "stroke-subtle",
};

const FILL: Record<NodeHealth, string> = {
  healthy: "fill-success",
  degraded: "fill-warning",
  down: "fill-danger",
  unknown: "fill-subtle",
};

const LEGEND: { health: NodeHealth; label: string }[] = [
  { health: "healthy", label: "Healthy" },
  { health: "degraded", label: "Degraded / stale" },
  { health: "down", label: "Down" },
  { health: "unknown", label: "Unknown" },
];

type Point = { x: number; y: number };

function onRing(index: number, count: number, radius: number): Point {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

/** Pulls an edge endpoint back to the node's rim so the arrowhead stays visible. */
function towards(from: Point, to: Point, stopShort: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: to.x - (dx / len) * stopShort, y: to.y - (dy / len) * stopShort };
}

/**
 * The agent mesh as a ring: services on the outside, their agents inside, with
 * a spoke from each agent to its service and a chord to the next agent. Arrows
 * point from watcher to watched. Healthy nodes carry the heartbeat ping.
 *
 * Hand-rolled SVG — a ring is a ring, and a force-directed library would spend
 * its weight fighting the layout the topology already implies.
 */
export function TopologyGraph({
  topology,
  activeId,
  onHover,
  onSelect,
}: {
  topology: Topology;
  /** Hovered or selected node — its edges light up. */
  activeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const services = topology.nodes.filter((n) => n.kind === "service");

  const positions = new Map<string, Point>();
  services.forEach((service, i) => {
    positions.set(service.id, onRing(i, services.length, SERVICE_RING));
    positions.set(
      `a:${service.id.slice(2)}`,
      onRing(i, services.length, AGENT_RING),
    );
  });

  const isActive = (id: string) => id === activeId;
  const touchesActive = (from: string, to: string) =>
    activeId !== null && (from === activeId || to === activeId);

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-[600px]">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Topology: ${services.length} services, ${services.length} agents, ${topology.edges.length} watch links`}
          onMouseLeave={() => onHover(null)}
        >
          <style>{`
            @keyframes topo-ping { 0% { transform: scale(1); opacity: .45 } 75%, 100% { transform: scale(2.4); opacity: 0 } }
            @keyframes topo-flow { to { stroke-dashoffset: -28 } }
            .topo-ping { animation: topo-ping 2.4s cubic-bezier(0, 0, .2, 1) infinite; }
            .topo-edge { stroke-dasharray: 5 9; animation: topo-flow 2s linear infinite; }
            @media (prefers-reduced-motion: reduce) {
              .topo-ping { animation: none; opacity: 0; }
              .topo-edge { animation: none; }
            }
          `}</style>

          <defs>
            <marker
              id="topo-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border-strong" />
            </marker>
            <marker
              id="topo-arrow-active"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-accent" />
            </marker>
          </defs>

          {/* Faint ring guides, so the layout reads as intentional. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={AGENT_RING}
            className="fill-none stroke-border"
            strokeWidth={1}
            strokeDasharray="2 6"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={SERVICE_RING}
            className="fill-none stroke-border"
            strokeWidth={1}
            strokeDasharray="2 6"
          />

          {topology.edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;

            const target = edge.to.startsWith("c:") ? "service" : "agent";
            const start = towards(to, from, RADIUS.agent + 2);
            const end = towards(from, to, RADIUS[target] + 6);
            const active = touchesActive(edge.from, edge.to);

            return (
              <line
                key={`${edge.from}->${edge.to}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                className={cn(
                  "topo-edge transition-[stroke] duration-200",
                  active ? "stroke-accent" : "stroke-border-strong",
                )}
                strokeWidth={active ? 2 : 1.5}
                markerEnd={
                  active ? "url(#topo-arrow-active)" : "url(#topo-arrow)"
                }
              />
            );
          })}

          {topology.nodes.map((node) => {
            const p = positions.get(node.id);
            if (!p) return null;

            const r = RADIUS[node.kind];
            const active = isActive(node.id);

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => onHover(node.id)}
                onClick={() => onSelect(node.id)}
              >
                <title>{`${node.name} · ${node.health}`}</title>

                {node.health === "healthy" && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    className={cn("topo-ping", FILL[node.health])}
                    style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                  />
                )}

                {active && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r + 6}
                    className="fill-none stroke-accent"
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                  />
                )}

                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  className={cn(
                    "fill-surface transition-[stroke-width] duration-150",
                    STROKE[node.health],
                  )}
                  strokeWidth={active ? 3 : 2}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={node.kind === "service" ? 6 : 4}
                  className={FILL[node.health]}
                />

                <text
                  x={p.x}
                  y={p.y + r + 15}
                  textAnchor="middle"
                  className={cn(
                    "pointer-events-none font-mono",
                    node.kind === "service"
                      ? "fill-fg text-[11px]"
                      : "fill-muted text-[10px]",
                  )}
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="text-subtle flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
        {LEGEND.map((item) => (
          <li key={item.health} className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                item.health === "healthy" && "bg-success",
                item.health === "degraded" && "bg-warning",
                item.health === "down" && "bg-danger",
                item.health === "unknown" && "bg-subtle",
              )}
              aria-hidden="true"
            />
            {item.label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span
            className="bg-border-strong h-px w-5"
            aria-hidden="true"
          />
          watches →
        </li>
      </ul>
    </div>
  );
}
