import { Activity, Cpu, Server, Timer } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartFrame,
  Pulse,
  StatTile,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  type Status,
} from "~/app/_components/ui";

/**
 * Internal design-system reference for Track A. Renders every token and
 * primitive so the foundation can be verified at a glance and reused
 * consistently as Tracks B and C are built out. Not linked from the app nav.
 */
export default function StyleguidePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-12">
        <p className="text-accent font-mono text-xs tracking-widest uppercase">
          Track A · Design system
        </p>
        <h1 className="font-display text-fg mt-2 text-4xl font-semibold">
          Continuum UI
        </h1>
        <p className="text-muted mt-3 max-w-2xl">
          Foundational tokens and primitives for the autonomous AI SRE. Electric
          indigo/violet accent, dark-first app surfaces, and the heartbeat pulse
          as the signature motif.
        </p>
      </header>

      <Section title="Color" eyebrow="Tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Swatch name="bg" className="bg-bg" />
          <Swatch name="surface" className="bg-surface" />
          <Swatch name="surface-2" className="bg-surface-2" />
          <Swatch name="border" className="bg-border" />
          <Swatch name="border-strong" className="bg-border-strong" />
          <Swatch name="accent" className="bg-accent" />
          <Swatch name="accent-strong" className="bg-accent-strong" />
          <Swatch name="success" className="bg-success" />
          <Swatch name="warning" className="bg-warning" />
          <Swatch name="danger" className="bg-danger" />
          <Swatch name="info" className="bg-info" />
          <Swatch name="fg" className="bg-fg" />
          <Swatch name="muted" className="bg-muted" />
          <Swatch name="subtle" className="bg-subtle" />
          <Swatch name="accent-soft" className="bg-accent-soft" />
        </div>
      </Section>

      <Section title="Typography" eyebrow="Type scale">
        <Card className="divide-border divide-y">
          <div className="px-5 py-4">
            <p className="font-display text-fg text-3xl font-semibold">
              Space Grotesk — display
            </p>
            <p className="text-subtle mt-1 text-xs">
              Headlines, wordmark, section titles
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-fg text-lg">
              Inter — body. Continuum watches your services and heals them
              before your users notice.
            </p>
            <p className="text-subtle mt-1 text-xs">UI text, prose, controls</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-fg font-mono text-base">
              JetBrains Mono — 99.98% · MTTR 42s · svc-7f3a9c
            </p>
            <p className="text-subtle mt-1 text-xs">
              Metrics, logs, IDs, topology labels
            </p>
          </div>
        </Card>
      </Section>

      <Section title="Buttons" eyebrow="Actions">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Deploy agent</Button>
            <Button variant="secondary">View logs</Button>
            <Button variant="ghost">Dismiss</Button>
            <Button variant="danger">Kill service</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </div>
      </Section>

      <Section title="Status & heartbeat" eyebrow="Signature">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            {(
              [
                "healthy",
                "degraded",
                "down",
                "pending",
                "resolved",
                "unknown",
              ] as Status[]
            ).map((status) => (
              <StatusPill key={status} status={status} />
            ))}
          </div>
          <div className="text-muted flex flex-wrap items-center gap-6 text-sm">
            <span className="flex items-center gap-2">
              <Pulse tone="success" /> healthy
            </span>
            <span className="flex items-center gap-2">
              <Pulse tone="warning" /> degraded
            </span>
            <span className="flex items-center gap-2">
              <Pulse tone="danger" /> down
            </span>
            <span className="flex items-center gap-2">
              <Pulse tone="accent" /> pending
            </span>
            <span className="flex items-center gap-2">
              <Pulse tone="muted" animate={false} /> idle
            </span>
          </div>
        </div>
      </Section>

      <Section title="Stat tiles" eyebrow="Metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Uptime"
            value="99.98"
            unit="%"
            delta="+0.04% vs last week"
            deltaDirection="up"
            icon={Activity}
          />
          <StatTile
            label="MTTR"
            value="42"
            unit="s"
            delta="-18s vs last week"
            deltaDirection="up"
            icon={Timer}
          />
          <StatTile
            label="Active agents"
            value="12"
            delta="2 respawned today"
            deltaDirection="neutral"
            icon={Cpu}
          />
          <StatTile
            label="Open incidents"
            value="3"
            delta="+1 in last hour"
            deltaDirection="down"
            icon={Server}
          />
        </div>
      </Section>

      <Section title="Table" eyebrow="Data">
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Service</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Agent</TableHeaderCell>
                <TableHeaderCell>Last check</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sampleRows.map((row) => (
                <TableRow key={row.service}>
                  <TableCell className="font-medium">{row.service}</TableCell>
                  <TableCell>
                    <StatusPill status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted font-mono">
                    {row.agent}
                  </TableCell>
                  <TableCell className="text-muted">{row.lastCheck}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section title="Chart frame" eyebrow="Visualization">
        <ChartFrame
          title="Incidents over time"
          description="Detected vs. auto-healed, last 24h"
          actions={
            <Button size="sm" variant="secondary">
              Export
            </Button>
          }
        >
          <div className="flex h-48 items-end gap-2">
            {[38, 52, 30, 64, 48, 72, 44, 58, 36, 68, 50, 60].map((h, i) => (
              <div
                key={i}
                className="bg-accent/70 flex-1 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </ChartFrame>
      </Section>

      <Section title="Light theme" eyebrow="Split · landing surface">
        <div
          data-theme="light"
          className="border-border bg-bg rounded-xl border p-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Self-healing, on by default</CardTitle>
                <CardDescription>
                  The same tokens, flipped to the light landing surface.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <StatusPill status="healthy" />
                <Button size="sm">Get started</Button>
              </CardContent>
            </Card>
            <StatTile
              label="Uptime"
              value="99.98"
              unit="%"
              delta="+0.04% vs last week"
              deltaDirection="up"
              icon={Activity}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

const sampleRows: {
  service: string;
  status: Status;
  agent: string;
  lastCheck: string;
}[] = [
  {
    service: "api-gateway",
    status: "healthy",
    agent: "agent-01",
    lastCheck: "2s ago",
  },
  {
    service: "payments",
    status: "degraded",
    agent: "agent-03",
    lastCheck: "4s ago",
  },
  {
    service: "search-index",
    status: "down",
    agent: "agent-07",
    lastCheck: "1s ago",
  },
  {
    service: "notifications",
    status: "resolved",
    agent: "agent-02",
    lastCheck: "6s ago",
  },
];

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="font-display text-fg text-xl font-semibold">{title}</h2>
        <span className="text-subtle font-mono text-xs tracking-wider uppercase">
          {eyebrow}
        </span>
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className={`h-16 w-full ${className}`} />
      <div className="bg-surface px-3 py-2">
        <p className="text-fg font-mono text-xs">{name}</p>
      </div>
    </div>
  );
}
