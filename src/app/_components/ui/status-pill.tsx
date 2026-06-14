import { cn } from "~/lib/cn";
import { Pulse, type PulseTone } from "./pulse";

export type Status =
  | "healthy"
  | "degraded"
  | "down"
  | "resolved"
  | "pending"
  | "unknown";

const config: Record<
  Status,
  { tone: PulseTone; label: string; className: string; pulse: boolean }
> = {
  healthy: {
    tone: "success",
    label: "Healthy",
    className: "bg-success-soft text-success",
    pulse: true,
  },
  degraded: {
    tone: "warning",
    label: "Degraded",
    className: "bg-warning-soft text-warning",
    pulse: true,
  },
  down: {
    tone: "danger",
    label: "Down",
    className: "bg-danger-soft text-danger",
    pulse: true,
  },
  resolved: {
    tone: "info",
    label: "Resolved",
    className: "bg-info-soft text-info",
    pulse: false,
  },
  pending: {
    tone: "accent",
    label: "Pending",
    className: "bg-accent-soft text-accent",
    pulse: true,
  },
  unknown: {
    tone: "muted",
    label: "Unknown",
    className: "bg-muted-soft text-subtle",
    pulse: false,
  },
};

/** Health badge carrying the heartbeat dot. `label` overrides the default text. */
export function StatusPill({
  status,
  label,
  className,
}: {
  status: Status;
  label?: string;
  className?: string;
}) {
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        c.className,
        className,
      )}
    >
      <Pulse tone={c.tone} animate={c.pulse} />
      {label ?? c.label}
    </span>
  );
}
