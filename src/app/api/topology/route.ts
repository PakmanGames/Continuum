import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { containerMetrics } from "~/lib/metrics";
import { STATUS_HEALTH } from "~/lib/container-status";
import {
  AGENT_FRESH_MS,
  AGENT_STALE_MS,
  type ContainerSource,
  type NodeHealth,
  type ServiceStatus,
  type Topology,
  type TopologyEdge,
  type TopologyNode,
} from "~/lib/topology";

/**
 * An agent that reported recently is live; one that has gone quiet is stale
 * before it is declared gone, so aged demo data reads as "stale" rather than
 * as a fleet-wide outage.
 */
function freshness(lastSeen: Date | null | undefined, now: number): NodeHealth {
  if (!lastSeen) return "unknown";
  const age = now - lastSeen.getTime();
  return age < AGENT_FRESH_MS ? "healthy" : age < AGENT_STALE_MS ? "degraded" : "down";
}

/**
 * Services come from `containers`; their health from the newest check-in plus
 * open incidents. Registered agents watch the containers assigned to them.
 * Seeded containers get a derived demo agent each, wired into a ring so no demo
 * agent is unobserved.
 */
export async function GET() {
  try {
    const containers = await db
      .select()
      .from(schema.containers)
      .orderBy(schema.containers.id);
    const agents = await db.select().from(schema.agents).orderBy(schema.agents.id);

    // Newest check-in per container in one query, rather than one query each.
    const latestCheckIns = await db
      .selectDistinctOn([schema.statuses.containerId])
      .from(schema.statuses)
      .orderBy(schema.statuses.containerId, desc(schema.statuses.checkedInAt));
    const latest = new Map(latestCheckIns.map((row) => [row.containerId, row]));

    const openRows = await db
      .select({ containerId: schema.errors.containerId })
      .from(schema.errors)
      .where(eq(schema.errors.resolved, false));
    const openByContainer = new Map<number, number>();
    for (const row of openRows) {
      openByContainer.set(row.containerId, (openByContainer.get(row.containerId) ?? 0) + 1);
    }

    const now = Date.now();
    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];

    for (const container of containers) {
      const checkIn = latest.get(container.id);
      const status = (checkIn?.status as ServiceStatus | undefined) ?? "stopped";
      const openIncidents = openByContainer.get(container.id) ?? 0;
      const base = STATUS_HEALTH[status];
      const health: NodeHealth =
        base === "healthy" && openIncidents > 0 ? "degraded" : base;

      nodes.push({
        id: `c:${container.id}`,
        kind: "service",
        name: container.name,
        health,
        watches: [],
        lastSeen: checkIn?.checkedInAt.toISOString() ?? null,
        source: container.source as ContainerSource,
        status,
        openIncidents,
        ...(status === "running" ? containerMetrics(container.id) : {}),
      });
    }

    // Demo agents: one per seeded container, each watching its service and the
    // next demo agent, so the ring closes.
    const seed = containers.filter((c) => c.source === "seed");
    seed.forEach((container, i) => {
      const id = `d:${container.id}`;
      const peer = seed[(i + 1) % seed.length]!;
      const watches =
        seed.length > 1 ? [`c:${container.id}`, `d:${peer.id}`] : [`c:${container.id}`];
      const checkIn = latest.get(container.id);
      nodes.push({
        id,
        kind: "agent",
        name: `agent-${container.id}`,
        health: freshness(checkIn?.checkedInAt, now),
        watches,
        lastSeen: checkIn?.checkedInAt.toISOString() ?? null,
        source: "seed",
      });
      for (const to of watches) edges.push({ from: id, to });
    });

    // Registered agents: real processes watching the containers they registered.
    for (const agent of agents) {
      const id = `a:${agent.id}`;
      const watches = containers
        .filter((c) => c.agentId === agent.id)
        .map((c) => `c:${c.id}`);
      nodes.push({
        id,
        kind: "agent",
        name: agent.name,
        health: freshness(agent.lastSeen, now),
        watches,
        lastSeen: agent.lastSeen?.toISOString() ?? null,
        source: "live",
      });
      for (const to of watches) edges.push({ from: id, to });
    }

    const body: Topology = { nodes, edges, generatedAt: new Date(now).toISOString() };
    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    console.error("Topology build failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
