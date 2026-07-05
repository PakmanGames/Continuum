/**
 * Contract for the chaos demo: a scripted, honestly-labelled fault that walks
 * one service through detect → diagnose → heal on the live topology.
 *
 * It is a *simulation* — nothing is done to a container. The demo writes the
 * same rows a real agent would (a crashed check-in and an incident, then a
 * running check-in and a resolution), so every other screen reacts for real:
 * the topology re-colours through its poll, the timeline gains an incident,
 * and MTTR on the dashboard moves.
 */

/** Every chaos incident's log starts with this, so they can be told apart and pruned. */
export const CHAOS_PREFIX = "[Chaos]";

/** Chaos incidents kept in the database; older ones are pruned on the next run. */
export const CHAOS_KEEP = 5;

export type ChaosFault = {
  title: string;
  logs: string;
  explanation: string;
  suggestedFix: string;
};

export const CHAOS_FAULTS: readonly ChaosFault[] = [
  {
    title: "Out of memory",
    logs: [
      "fatal: runtime: out of memory",
      "  allocating 512 MiB for job buffer (limit 512 MiB)",
      "  container killed by OOM killer, exit code 137",
    ].join("\n"),
    explanation:
      "The worker allocated its full memory limit while buffering an oversized job payload, and the kernel OOM-killed the process. It will restart-loop until the payload is bounded or the limit raised.",
    suggestedFix:
      "Raise the container memory limit to 1 GiB and cap job payloads at 64 MiB with queue backpressure, so a single job cannot exhaust the heap.",
  },
  {
    title: "Connection pool exhausted",
    logs: [
      "error: timeout acquiring connection from pool (max 20, waiting 47)",
      "  PoolTimeoutError at db/pool.ts:88",
      "  health check failed 3/3 — marking unhealthy",
    ].join("\n"),
    explanation:
      "Every pooled database connection is held by long-running report queries, so request handlers time out waiting for one. The health check shares that pool and fails with them.",
    suggestedFix:
      "Move report queries to a separate read pool, add a 5s statement timeout, and give the health check its own dedicated connection.",
  },
  {
    title: "TLS certificate expired",
    logs: [
      "tls: handshake failure: certificate has expired",
      "  upstream auth-idp rejected 100% of requests in the last 60s",
      "  process exiting: unrecoverable configuration",
    ].join("\n"),
    explanation:
      "The service's client certificate for the identity provider expired at midnight, so every outbound auth call fails the TLS handshake and the process treats that as fatal.",
    suggestedFix:
      "Rotate the client certificate from the secrets store and add a 14-day expiry alert so the next one is caught before it fails closed.",
  },
  {
    title: "Disk full",
    logs: [
      "write /var/log/app.log: no space left on device",
      "  ENOSPC in logger.flush()",
      "  panic: cannot continue without a writable log volume",
    ].join("\n"),
    explanation:
      "Verbose debug logging filled the container's log volume. The logger's flush failed with ENOSPC and the process panicked rather than dropping log lines.",
    suggestedFix:
      "Cap the log volume with rotation at 200 MiB, drop DEBUG in production, and make the logger degrade to stderr instead of panicking.",
  },
];

export type ChaosInjectResult = {
  incidentId: number;
  container: string;
  fault: ChaosFault;
  occurredAt: string;
};

export type ChaosHealResult = {
  occurredAt: string;
  resolvedAt: string;
};
