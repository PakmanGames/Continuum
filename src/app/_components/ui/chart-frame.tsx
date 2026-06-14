import { cn } from "~/lib/cn";
import { Card } from "./card";

/**
 * Consistent framing for any chart: title, optional description, an actions slot
 * (filters, legends), and a fixed-min-height plot area. The chart itself — a
 * Recharts/SVG element, added in Track C — is passed as children.
 */
export function ChartFrame({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-display text-fg text-sm font-semibold">
            {title}
          </h3>
          {description && <p className="text-muted text-xs">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="min-h-48 px-3 py-4">{children}</div>
    </Card>
  );
}
