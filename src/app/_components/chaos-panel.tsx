"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FlaskConical, Loader2, Radio, Zap } from "lucide-react";

import { cn } from "~/lib/cn";
import type { ChaosHealResult, ChaosInjectResult } from "~/lib/chaos";
import type { AgentCommand } from "~/lib/commands";
import type { TopologyNode } from "~/lib/topology";
import { Button, Card } from "./ui";

/** Simulated pacing — long enough for the 2s topology poll to paint each step. */
const DETECT_MS = 2500;
const DIAGNOSE_MS = 3000;
const HEAL_MS = 3000;
/** Live mode reads the real graph; the agent's verify window needs room. */
const LIVE_TICK_MS = 1500;
const LIVE_TIMEOUT_MS = 120_000;

type Mode = "simulated" | "live";
type Phase =
  | "idle"
  | "injecting"
  | "detected"
  | "diagnosing"
  | "healing"
  | "healed"
  | "failed";

const STEPS: Record<Mode, readonly [string, string, string, string]> = {
  simulated: ["Inject", "Detect", "Diagnose", "Heal"],
  live: ["Kill", "Detect", "Diagnose", "Heal"],
};

/** Which step is underway (0-based) for a phase; -1 before start, 4 when done. */
const STEP_FOR: Record<Phase, number> = {
  idle: -1,
  injecting: 0,
  detected: 1,
  diagnosing: 2,
  healing: 3,
  healed: 4,
  failed: -1,
};
const PHASE_FOR_STAGE: Record<number, Phase> = {
  1: "detected",
  2: "diagnosing",
  3: "healing",
  4: "healed",
};

/** Row shape from `GET /api/error`. */
type Incident = {
  id: number;
  containerId: number;
  explaination: string;
  suggestedFix: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
  occurredAt: string;
};

type Pick = { id: string; name: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

async function newestIncident(containerId: number): Promise<Incident | null> {
  const response = await fetch("/api/error");
  if (!response.ok) return null;
  const rows = (await response.json()) as Incident[];
  return (
    rows.filter((r) => r.containerId === containerId).sort((a, b) => b.id - a.id)[0] ??
    null
  );
}

const secondsBetween = (from: string, to: string) =>
  Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));

/**
 * Fault injection against the topology, in two honest flavours.
 *
 * **Simulated** targets the seeded demo fleet: it writes a scripted incident
 * and heals it on paper — no container is touched, and it says so.
 *
 * **Live** targets a real container: it queues a `kill` for the agent watching
 * it, then simply watches the graph the page keeps polling. Every step shown
 * is something that actually happened — the container left `running`, the
 * agent filed an incident, restarted it, verified it, and closed the incident.
 */
export function ChaosPanel({
  nodes,
  onFocus,
}: {
  nodes: TopologyNode[];
  /** Pins a node on the graph while a run is in flight. */
  onFocus: (nodeId: string | null) => void;
}) {
  const services = nodes.filter((n) => n.kind === "service");
  const seed = services.filter((s) => s.source === "seed" && s.status === "running");
  const live = services.filter((s) => s.source === "live" && s.status === "running");
  const watcherOf = (id: string) =>
    nodes.find((n) => n.kind === "agent" && n.watches.includes(id))?.name ?? "the agent";

  const [mode, setMode] = useState<Mode>(() => (live.length ? "live" : "simulated"));
  const [victim, setVictim] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  /** The service under test, fixed for the whole run. */
  const [target, setTarget] = useState<Pick | null>(null);
  const [inject, setInject] = useState<ChaosInjectResult | null>(null);
  const [heal, setHeal] = useState<ChaosHealResult | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [seenStatus, setSeenStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const running = phase !== "idle" && phase !== "healed" && phase !== "failed";
  const cancelled = useRef(false);
  const openRun = useRef<{ containerId: number; incidentId: number } | null>(null);
  // Live mode reads the graph the page keeps re-fetching; a ref avoids stale closures.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // If the live agent goes away while idle, don't leave the panel on an empty list.
  useEffect(() => {
    if (mode === "live" && live.length === 0 && !running && !target) setMode("simulated");
  }, [mode, live.length, running, target]);

  useEffect(() => {
    return () => {
      cancelled.current = true;
      // Never strand a seeded service crashed on paper because the tab was closed.
      // (A live run needs nothing: the agent finishes on its own.)
      if (openRun.current) {
        void fetch("/api/chaos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "heal", ...openRun.current }),
          keepalive: true,
        });
      }
    };
  }, []);

  const pool = mode === "live" ? live : seed;
  // The last target stays selectable while it is not `running` — during a run
  // and for one poll after — otherwise the control blinks to a neighbour.
  const options: Pick[] =
    target && !pool.some((s) => s.id === target.id) ? [target, ...pool] : pool;
  const chosen = options.find((s) => s.id === (victim || target?.id)) ?? options[0] ?? null;

  const begin = (pick: Pick) => {
    cancelled.current = false;
    setError(null);
    setInject(null);
    setHeal(null);
    setIncident(null);
    setSeenStatus(null);
    setTarget(pick);
    setPhase("injecting");
    onFocus(pick.id);
  };

  const runSimulated = async () => {
    if (!chosen) return;
    const containerId = Number(chosen.id.slice(2));
    begin(chosen);
    try {
      const injected = await postJson<ChaosInjectResult>("/api/chaos", {
        step: "inject",
        containerId,
      });
      openRun.current = { containerId, incidentId: injected.incidentId };
      setInject(injected);

      await sleep(DETECT_MS);
      if (cancelled.current) return;
      setPhase("detected");
      await sleep(DIAGNOSE_MS);
      if (cancelled.current) return;
      setPhase("diagnosing");
      await sleep(HEAL_MS);
      if (cancelled.current) return;
      setPhase("healing");

      const healed = await postJson<ChaosHealResult>("/api/chaos", {
        step: "heal",
        containerId,
        incidentId: injected.incidentId,
      });
      openRun.current = null;
      setHeal(healed);
      setPhase("healed");
    } catch (err) {
      console.error("Chaos run failed:", err);
      setError(err instanceof Error ? err.message : "Chaos run failed");
      setPhase("failed");
    }
  };

  const runLive = async () => {
    if (!chosen) return;
    const containerId = Number(chosen.id.slice(2));
    begin(chosen);
    try {
      const command = await postJson<AgentCommand>("/api/commands", {
        containerId,
        action: "kill",
      });

      const started = Date.now();
      let step = 0;
      let sawIncident = false;
      while (Date.now() - started < LIVE_TIMEOUT_MS) {
        await sleep(LIVE_TICK_MS);
        if (cancelled.current) return;
        const node = nodesRef.current.find((n) => n.id === chosen.id);
        if (!node) continue;
        const open = node.openIncidents ?? 0;

        // Derive the furthest stage the graph proves, so a missed poll can't
        // stall the stepper: an incident implies detection, running-with-no-
        // incident after an incident implies the heal.
        let stage = 0;
        if (open > 0) {
          sawIncident = true;
          stage = node.status === "running" ? 3 : 2;
        } else if (node.status !== "running") {
          stage = 1;
        } else if (sawIncident) {
          stage = 4;
        }

        if (stage >= 1 && seenStatus === null && node.status !== "running") {
          setSeenStatus(node.status ?? null);
        }
        if (stage >= 2 && !incident) {
          const found = await newestIncident(containerId);
          if (found) setIncident(found);
        }
        if (stage > step) {
          step = stage;
          setPhase(PHASE_FOR_STAGE[stage]!);
        }
        if (step === 4) {
          setIncident(await newestIncident(containerId));
          return;
        }
        if (step === 0) {
          const res = await fetch(`/api/commands?containerId=${containerId}`);
          const mine = res.ok
            ? ((await res.json()) as { commands: AgentCommand[] }).commands.find(
                (c) => c.id === command.id,
              )
            : undefined;
          if (mine?.status === "failed") {
            throw new Error(`The agent could not kill the container: ${mine.result ?? "no detail"}`);
          }
        }
      }
      throw new Error("The agent hasn't healed it within two minutes — check its logs.");
    } catch (err) {
      console.error("Live chaos run failed:", err);
      setError(err instanceof Error ? err.message : "Live run failed");
      setPhase("failed");
    }
  };

  const current = STEP_FOR[phase];
  const shown = target ?? chosen;
  const demoAgent = shown ? `agent-${shown.id.slice(2)}` : "the agent";
  const simSeconds = heal ? secondsBetween(heal.occurredAt, heal.resolvedAt) : null;
  const liveSeconds =
    incident?.resolvedAt ? secondsBetween(incident.occurredAt, incident.resolvedAt) : null;

  const stepText = (i: number): string | null => {
    if (mode === "simulated") {
      if (!inject) return null;
      if (i === 0) return `${inject.fault.title} on ${inject.container}`;
      if (i === 1 && current >= 1) return `${demoAgent} flagged ${inject.container} as crashed`;
      if (i === 2 && current >= 2) return inject.fault.explanation;
      if (i === 3 && current >= 3) return inject.fault.suggestedFix;
      return null;
    }
    if (!shown) return null;
    if (i === 0) return current >= 1 ? `${shown.name} killed` : `kill queued for ${watcherOf(shown.id)}`;
    if (i === 1 && current >= 1) return `${watcherOf(shown.id)} flagged ${shown.name} as ${seenStatus ?? "down"}`;
    if (i === 2 && current >= 2) return incident?.explaination ?? "waiting for the agent's diagnosis…";
    if (i === 3 && current >= 3) {
      return incident?.resolution
        ? `${incident.resolution} — proposed fix: ${incident.suggestedFix}`
        : `restarted by ${watcherOf(shown.id)} — verifying it stays up…`;
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-fg flex items-center gap-2 text-sm font-semibold">
            {mode === "live" ? (
              <Radio className="text-danger h-4 w-4" aria-hidden="true" />
            ) : (
              <FlaskConical className="text-accent h-4 w-4" aria-hidden="true" />
            )}
            Chaos demo
          </h2>
          <p className="text-subtle mt-1 text-xs">
            {mode === "live"
              ? "Live — sends a real kill to the agent. It detects, diagnoses, restarts and verifies."
              : "Simulated — writes a scripted incident and heals it. No container is touched."}
          </p>
        </div>
      </div>

      {live.length > 0 && (
        <div
          className="bg-surface-2 mt-4 inline-flex rounded-md p-0.5 text-xs"
          role="radiogroup"
          aria-label="Chaos target fleet"
        >
          {(["live", "simulated"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m);
                setVictim("");
              }}
              disabled={running}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors disabled:opacity-60",
                mode === m ? "bg-bg text-fg shadow-sm" : "text-muted hover:text-fg",
              )}
            >
              {m === "live" ? `Live containers (${live.length})` : `Demo fleet (${seed.length})`}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-end gap-2">
        <label className="flex-1">
          <span className="text-subtle block text-xs">Service</span>
          <select
            value={chosen?.id ?? ""}
            onChange={(e) => setVictim(e.target.value)}
            disabled={running || options.length === 0}
            className="border-border bg-bg text-fg focus:border-accent mt-1 h-9 w-full rounded-md border px-2 font-mono text-xs outline-none disabled:opacity-60"
          >
            {options.length === 0 ? (
              <option value="">
                {mode === "live" ? "no running live containers" : "no healthy demo services"}
              </option>
            ) : (
              options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            )}
          </select>
        </label>
        <Button
          size="sm"
          variant={phase === "healed" ? "secondary" : "danger"}
          onClick={() => void (mode === "live" ? runLive() : runSimulated())}
          disabled={running || !chosen}
        >
          {running ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Zap className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          )}
          {phase === "healed"
            ? "Run again"
            : running
              ? "Running…"
              : mode === "live"
                ? "Kill container"
                : "Inject fault"}
        </Button>
      </div>

      {phase !== "idle" && (
        <ol className="mt-5 space-y-3">
          {STEPS[mode].map((label, i) => {
            const done = current > i;
            const active = current === i;
            const text = stepText(i);
            return (
              <li key={label} className="flex gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    done && "bg-success text-white",
                    active && "bg-accent text-accent-contrast",
                    !done && !active && "bg-surface-2 text-subtle",
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", done || active ? "text-fg" : "text-subtle")}>
                    {label}
                  </p>
                  {text && <p className="text-muted mt-0.5 text-xs leading-relaxed">{text}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {phase === "healed" && mode === "simulated" && simSeconds !== null && (
        <p className="bg-success-soft text-success mt-5 rounded-md px-3 py-2 text-xs font-medium">
          Restored in {simSeconds}s — incident recorded on the timeline.
        </p>
      )}
      {phase === "healed" && mode === "live" && (
        <p className="bg-success-soft text-success mt-5 rounded-md px-3 py-2 text-xs font-medium">
          {liveSeconds !== null ? `Restored in ${liveSeconds}s` : "Restored"} —{" "}
          {incident?.resolution ?? "healed by the agent"}. Fix proposed, not applied.
        </p>
      )}
      {phase === "failed" && error && (
        <p className="text-danger mt-5 text-xs" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
