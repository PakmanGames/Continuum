"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Sparkles, Wrench } from "lucide-react";

import { Card, StatusPill } from "~/app/_components/ui";
import { PageTransition } from "~/app/_components/page-transition";
import { ResolveIncidentButton } from "~/app/_components/resolve-incident-button";

/** Row shape from `GET /api/error/[id]`. */
type IncidentRow = {
  id: number;
  agentId: number;
  containerId: number;
  serviceName: string;
  errorMessage: string;
  explaination: string;
  suggestedFix: string;
  resolved: boolean;
  resolvedAt: string | null;
  /** "agent" when the remediation loop closed it, "human" when someone clicked. */
  resolvedBy: string | null;
  /** What closed it, e.g. "restart: healthy for 15s". */
  resolution: string | null;
  occurredAt: string;
};

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [incident, setIncident] = useState<IncidentRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/error/${id}`);
      if (response.status === 404) notFound();
      if (!response.ok) throw new Error("Failed to load this incident");
      setIncident((await response.json()) as IncidentRow);
    } catch (err) {
      console.error("Incident load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load incident");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-surface-2 h-9 w-64 animate-pulse rounded" />
        <div className="bg-surface-2 h-32 animate-pulse rounded-xl" />
        <div className="bg-surface-2 h-40 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="flex flex-col items-center gap-4 py-16 text-center">
          <AlertTriangle className="text-danger h-8 w-8" aria-hidden="true" />
          <p className="text-fg font-medium">{error}</p>
          <Link
            href="/dashboard"
            className="text-accent hover:text-accent-strong text-sm font-medium transition-colors"
          >
            Back to the dashboard
          </Link>
        </Card>
      </div>
    );
  }

  if (!incident) notFound();

  const occurred = new Date(incident.occurredAt);

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/timeline"
          className="text-muted hover:text-fg inline-flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Timeline
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-fg text-3xl font-semibold">
                {incident.serviceName}
              </h1>
              <StatusPill
                status={incident.resolved ? "resolved" : "down"}
                label={incident.resolved ? "Resolved" : "Active"}
              />
            </div>
            <p className="text-muted mt-1.5 text-sm">
              <time dateTime={incident.occurredAt}>
                {occurred.toLocaleString()}
              </time>
              {incident.resolved && incident.resolvedAt && (
                <>
                  {" · resolved "}
                  <time dateTime={incident.resolvedAt}>
                    {new Date(incident.resolvedAt).toLocaleString()}
                  </time>
                  {incident.resolvedBy && ` by ${incident.resolvedBy}`}
                  {incident.resolution && (
                    <>
                      {" · "}
                      <span className="text-fg font-mono">{incident.resolution}</span>
                    </>
                  )}
                </>
              )}
              {" · agent "}
              <span className="font-mono">#{incident.agentId}</span>
            </p>
          </div>
          {!incident.resolved && (
            <ResolveIncidentButton
              incidentId={incident.id.toString()}
              onResolved={load}
            />
          )}
        </header>

        <Card className="p-6">
          <h2 className="font-display text-fg flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="text-accent h-4 w-4" aria-hidden="true" />
            What the agent found
          </h2>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            {incident.explaination}
          </p>
        </Card>

        <Card className="border-accent/30 bg-accent-soft p-6">
          <h2 className="font-display text-fg flex items-center gap-2 text-sm font-semibold">
            <Wrench className="text-accent h-4 w-4" aria-hidden="true" />
            Suggested fix
          </h2>
          <div className="border-border bg-bg mt-3 overflow-x-auto rounded-md border p-4">
            <pre className="text-fg font-mono text-sm whitespace-pre-wrap">
              {incident.suggestedFix}
            </pre>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-border border-b px-5 py-4">
            <h2 className="font-display text-fg text-sm font-semibold">
              Raw logs
            </h2>
          </div>
          <div className="p-5">
            <div className="border-border bg-bg max-h-80 overflow-auto rounded-md border p-4">
              <pre className="text-muted font-mono text-xs whitespace-pre-wrap">
                {incident.errorMessage}
              </pre>
            </div>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
