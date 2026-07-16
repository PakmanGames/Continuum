/**
 * Shapes shared by `GET /api/topology` and the graph that renders it.
 *
 * Two kinds of agent share the graph. Registered agents are real rows
 * (`agents`) watching the live containers assigned to them. The seeded demo
 * fleet has no agent, so one is *derived* per seed container and wired into a
 * ring — labelled "demo" so nobody mistakes it for a running process.
 */

export type NodeHealth = "healthy" | "degraded" | "down" | "unknown";

import type { ContainerStatus } from "./container-status";

export type ServiceStatus = ContainerStatus;

/** `seed` = the demo fleet from the seed scripts; `live` = registered by an agent. */
export type ContainerSource = "seed" | "live";

export type TopologyNode = {
  /**
   * `c:<containerId>` for a service · `a:<agentId>` for a real, registered
   * agent · `d:<containerId>` for the demo agent derived from a seeded row.
   */
  id: string;
  kind: "service" | "agent";
  name: string;
  health: NodeHealth;
  /** Node ids this one monitors. Always empty for a service. */
  watches: string[];
  /** Newest check-in for the underlying container, ISO string. */
  lastSeen: string | null;
  /** Seed-fleet nodes (and their derived agents) are labelled "demo" in the UI. */
  source: ContainerSource;
  status?: ServiceStatus;
  openIncidents?: number;
  cpu?: number;
  memory?: number;
};

export type TopologyEdge = { from: string; to: string };

export type Topology = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  generatedAt: string;
};

/** A check-in younger than this means the agent is live. */
export const AGENT_FRESH_MS = 10 * 60_000;

/** Older than this and the agent is presumed gone, not merely quiet. */
export const AGENT_STALE_MS = 24 * 60 * 60_000;
