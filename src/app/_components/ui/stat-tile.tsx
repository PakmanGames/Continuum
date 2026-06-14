import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "~/lib/cn";
import { Card } from "./card";

/**
 * Single KPI tile: label, big mono value, optional unit, and an optional delta.
 * `deltaDirection` colors the delta (up=success, down=danger, neutral=muted) —
 * the caller decides which direction is "good" for the metric in question.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaDirection = "neutral",
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  className?: string;
}) {
  const positive = deltaDirection === "up";
  const negative = deltaDirection === "down";
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-subtle text-xs font-medium tracking-wide uppercase">
          {label}
        </span>
        {Icon && <Icon className="text-subtle h-4 w-4" aria-hidden="true" />}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-fg font-mono text-3xl font-semibold tabular-nums">
          {value}
        </span>
        {unit && <span className="text-muted text-sm">{unit}</span>}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-xs font-medium",
            positive && "text-success",
            negative && "text-danger",
            !positive && !negative && "text-muted",
          )}
        >
          {positive && (
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {negative && (
            <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {delta}
        </div>
      )}
    </Card>
  );
}
