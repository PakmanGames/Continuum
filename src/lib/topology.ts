/**
 * Shapes shared by `GET /api/topology` and the graph that renders it.
 *
 * The database has no notion of an agent or of who watches whom — a `containers`
 * row doubles as an agent's identity (the Python agent heartbeats under its own
 * id), and its targets never reach the DB. So the topology is *derived*: one
 * agent per container, wired into a ring. If the schema ever grows `agents` and
 * `watches` tables, this module is the seam — the graph only knows these types.
 */

export type NodeHealth = "healthy" | "degraded" | "down" | "unknown";

export type ServiceStatus = "running" | "stopped" | "crashed";

export type TopologyNode = {
  /** `c:<containerId>` for a service, `a:<containerId>` for its agent. */
  id: string;
  kind: "service" | "agent";
  name: string;
  health: NodeHealth;
  /** Node ids this one monitors. Always empty for a service. */
  watches: string[];
  /** Newest check-in for the underlying container, ISO string. */
  lastSeen: string | null;
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
