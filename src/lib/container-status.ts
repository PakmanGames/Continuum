/**
 * One vocabulary for a container's state, shared by the heartbeat route (what
 * an agent may report), the topology and fleet APIs, and the pages that render
 * them. Docker's own states plus the two the seed scripts use.
 */
export const CONTAINER_STATUSES = [
  "running",
  "exited",
  "restarting",
  "dead",
  "paused",
  "created",
  "stopped",
  "crashed",
] as const;
export type ContainerStatus = (typeof CONTAINER_STATUSES)[number];

export type ContainerHealth = "healthy" | "degraded" | "down" | "unknown";

/** How each state reads on a health pill or a topology node. */
export const STATUS_HEALTH: Record<ContainerStatus, ContainerHealth> = {
  running: "healthy",
  restarting: "degraded",
  paused: "degraded",
  exited: "down",
  dead: "down",
  crashed: "down",
  created: "unknown",
  stopped: "unknown",
};

export const STATUS_LABEL: Record<ContainerStatus, string> = {
  running: "Running",
  restarting: "Restarting",
  paused: "Paused",
  exited: "Exited",
  dead: "Dead",
  crashed: "Crashed",
  created: "Created",
  stopped: "Stopped",
};
