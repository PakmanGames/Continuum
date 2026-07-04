import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { containerMetrics } from "~/lib/metrics";
import {
  AGENT_FRESH_MS,
  AGENT_STALE_MS,
  type NodeHealth,
  type ServiceStatus,
  type Topology,
  type TopologyEdge,
  type TopologyNode,
} from "~/lib/topology";

/**
 * Derives the agent mesh from the tables that exist.
 *
 * Every container gets one agent, and agents form a ring: each watches its own
 * service plus the next agent, so no agent is unobserved. Service health comes
 * from the newest status row (plus any open incident); agent health from how
 * recently that same container checked in. See `src/lib/topology.ts` for why
 * this is computed rather than stored.
 */
export async function GET() {
  try {
    const containers = await db
      .select()
      .from(schema.containers)
      .orderBy(schema.containers.id);

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
      openByContainer.set(
        row.containerId,
        (openByContainer.get(row.containerId) ?? 0) + 1,
      );
    }

    const now = Date.now();
    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];

    containers.forEach((container, i) => {
      const serviceId = `c:${container.id}`;
      const agentId = `a:${container.id}`;
      const checkIn = latest.get(container.id);
      const lastSeen = checkIn?.checkedInAt.toISOString() ?? null;

      const status = (checkIn?.status as ServiceStatus | undefined) ?? "stopped";
      const openIncidents = openByContainer.get(container.id) ?? 0;
      const serviceHealth: NodeHealth =
        status === "crashed"
          ? "down"
          : status !== "running"
            ? "unknown"
            : openIncidents > 0
              ? "degraded"
              : "healthy";

      nodes.push({
        id: serviceId,
        kind: "service",
        name: container.name,
        health: serviceHealth,
        watches: [],
        lastSeen,
        status,
        openIncidents,
        ...(status === "running" ? containerMetrics(container.id) : {}),
      });

      // An agent that reported recently is live; one that has gone quiet is
      // stale before it is declared gone, so aged demo data reads as "stale"
      // rather than as a fleet-wide outage.
      const age = checkIn ? now - checkIn.checkedInAt.getTime() : null;
      const agentHealth: NodeHealth =
        age === null
          ? "unknown"
          : age < AGENT_FRESH_MS
            ? "healthy"
            : age < AGENT_STALE_MS
              ? "degraded"
              : "down";

      const peer = containers[(i + 1) % containers.length]!;
      const watches =
        containers.length > 1 ? [serviceId, `a:${peer.id}`] : [serviceId];

      nodes.push({
        id: agentId,
        kind: "agent",
        name: `agent-${container.id}`,
        health: agentHealth,
        watches,
        lastSeen,
      });

      for (const to of watches) edges.push({ from: agentId, to });
    });

    const body: Topology = {
      nodes,
      edges,
      generatedAt: new Date(now).toISOString(),
    };
    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    console.error("Topology build failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
