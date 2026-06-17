"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { LayoutWrapper } from "~/app/_components/layout-wrapper";
import { ResolveIncidentButton } from "~/app/_components/resolve-incident-button";
import { PageTransition } from "~/app/_components/page-transition";
import { mockIncidents } from "~/lib/mock-data";

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // INTEGRATION: Replace with tRPC call
  // const incident = await api.incidents.getById({ id: params.id });
  const resolvedParams = use(params);
  const incident = mockIncidents.find((i) => i.id === resolvedParams.id);

  if (!incident) {
    notFound();
  }

  return (
    <LayoutWrapper>
      <PageTransition>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--fg)]">
                Incident Details
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {incident.serverName} • {incident.timestamp.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {incident.resolved ? (
                <span className="badge-success inline-flex items-center rounded-full px-3 py-1 text-sm font-medium">
                  Resolved
                </span>
              ) : (
                <span className="badge-error inline-flex items-center rounded-full px-3 py-1 text-sm font-medium">
                  Active
                </span>
              )}
              {!incident.resolved && (
                <ResolveIncidentButton incidentId={incident.id} />
              )}
            </div>
          </div>

          {/* AI Summary */}
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-semibold text-[var(--fg)]">
              AI Summary
            </h2>
            <p className="text-sm leading-relaxed text-[var(--fg)]">
              {incident.aiSummary}
            </p>
          </div>

          {/* Suggested Fix */}
          <div className="rounded-lg border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent-strong)]/10 p-6 backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-semibold text-[var(--accent)]">
              Suggested Fix
            </h2>
            <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4">
              <pre className="font-mono text-sm whitespace-pre-wrap text-[var(--fg)]">
                {incident.aiFix}
              </pre>
            </div>
          </div>

          {/* Raw Logs */}
          <div className="card">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-semibold text-[var(--fg)]">Raw Logs</h2>
            </div>
            <div className="px-6 py-4">
              <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--bg)] p-4">
                <pre className="font-mono text-xs whitespace-pre text-[var(--fg)]">
                  {incident.logs}
                </pre>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="card flex items-center justify-between p-6">
            <div>
              <h3 className="text-sm font-medium text-[var(--fg)]">
                Related Deployment
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                View deployment history for this server
              </p>
            </div>
            {/* INTEGRATION: Replace with actual link */}
            <button
              onClick={() => {
                // INTEGRATION: Navigate to deployment page
                alert(
                  "View related deployment - INTEGRATION: Add deployment page",
                );
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--border)]"
            >
              View Deployment
            </button>
          </div>
        </div>
      </PageTransition>
    </LayoutWrapper>
  );
}
