"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FlaskConical, Loader2, Zap } from "lucide-react";

import { cn } from "~/lib/cn";
import type { ChaosHealResult, ChaosInjectResult } from "~/lib/chaos";
import { Button, Card } from "./ui";

/** Long enough for the 2s topology poll to paint the crash before "Detected". */
const DETECT_MS = 2500;
const DIAGNOSE_MS = 3000;
const HEAL_MS = 3000;

type Phase =
  | "idle"
  | "injecting"
  | "detected"
  | "diagnosing"
  | "healing"
  | "healed"
  | "failed";

const STEPS = ["Inject", "Detect", "Diagnose", "Heal"] as const;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chaos<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/chaos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Chaos step failed");
  return data;
}

/**
 * Scripted fault injection against the live topology. Picks a healthy service,
 * writes a real crash + incident, waits for the graph to catch it, reveals the
 * diagnosis, then writes the fix. If the page unmounts mid-run the heal is
 * still sent, so a demo can't leave a service crashed on paper.
 */
export function ChaosPanel({
  services,
  onFocus,
}: {
  services: { id: string; name: string }[];
  /** Pins a node on the graph while a run is in flight. */
  onFocus: (nodeId: string | null) => void;
}) {
  const [victim, setVictim] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [inject, setInject] = useState<ChaosInjectResult | null>(null);
  const [heal, setHeal] = useState<ChaosHealResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelled = useRef(false);
  const openRun = useRef<{ containerId: number; incidentId: number } | null>(
    null,
  );

  const chosen = services.find((s) => s.id === victim) ?? services[0] ?? null;
  const running = phase !== "idle" && phase !== "healed" && phase !== "failed";

  useEffect(() => {
    return () => {
      cancelled.current = true;
      // Never strand a service crashed on paper because the tab was closed.
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

  const run = async () => {
    if (!chosen) return;
    const containerId = Number(chosen.id.slice(2));

    cancelled.current = false;
    setError(null);
    setInject(null);
    setHeal(null);
    setPhase("injecting");
    onFocus(chosen.id);

    try {
      const injected = await chaos<ChaosInjectResult>({
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

      const healed = await chaos<ChaosHealResult>({
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

  const current = STEP_FOR[phase];
  const agentName = chosen ? `agent-${chosen.id.slice(2)}` : "the agent";
  const healSeconds =
    heal
      ? Math.max(
          1,
          Math.round(
            (new Date(heal.resolvedAt).getTime() -
              new Date(heal.occurredAt).getTime()) /
              1000,
          ),
        )
      : null;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-fg flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="text-accent h-4 w-4" aria-hidden="true" />
            Chaos demo
          </h2>
          <p className="text-subtle mt-1 text-xs">
            Simulated — writes a scripted incident and heals it. No container is
            touched.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-end gap-2">
        <label className="flex-1">
          <span className="text-subtle block text-xs">Service</span>
          <select
            value={chosen?.id ?? ""}
            onChange={(e) => setVictim(e.target.value)}
            disabled={running || services.length === 0}
            className="border-border bg-bg text-fg focus:border-accent mt-1 h-9 w-full rounded-md border px-2 font-mono text-xs outline-none disabled:opacity-60"
          >
            {services.length === 0 ? (
              <option value="">no healthy services</option>
            ) : (
              services.map((s) => (
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
          onClick={() => void run()}
          disabled={running || !chosen}
        >
          {running ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Zap className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          )}
          {phase === "healed" ? "Run again" : running ? "Running…" : "Inject fault"}
        </Button>
      </div>

      {phase !== "idle" && (
        <ol className="mt-5 space-y-3">
          {STEPS.map((label, i) => {
            const done = current > i;
            const active = current === i;
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
                  <p
                    className={cn(
                      "text-sm font-medium",
                      done || active ? "text-fg" : "text-subtle",
                    )}
                  >
                    {label}
                  </p>

                  {i === 0 && inject && (
                    <p className="text-muted mt-0.5 text-xs">
                      {inject.fault.title} on{" "}
                      <span className="font-mono">{inject.container}</span>
                    </p>
                  )}
                  {i === 1 && current >= 1 && inject && (
                    <p className="text-muted mt-0.5 text-xs">
                      <span className="font-mono">{agentName}</span> flagged{" "}
                      <span className="font-mono">{inject.container}</span> as
                      crashed
                    </p>
                  )}
                  {i === 2 && current >= 2 && inject && (
                    <p className="text-muted mt-0.5 text-xs leading-relaxed">
                      {inject.fault.explanation}
                    </p>
                  )}
                  {i === 3 && current >= 3 && inject && (
                    <p className="text-muted mt-0.5 text-xs leading-relaxed">
                      {inject.fault.suggestedFix}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {phase === "healed" && healSeconds !== null && (
        <p className="bg-success-soft text-success mt-5 rounded-md px-3 py-2 text-xs font-medium">
          Restored in {healSeconds}s — incident recorded on the timeline.
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
