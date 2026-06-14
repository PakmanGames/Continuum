import { cn } from "~/lib/cn";

export type PulseTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "muted";

const toneText: Record<PulseTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  accent: "text-accent",
  muted: "text-subtle",
};

/**
 * Live status dot — the product's signature "heartbeat" motif. A steady core
 * with an expanding ping ring, tinted by health tone. Set `animate={false}` for
 * settled/resolved states; reduced-motion users get the static form for free
 * (globals.css disables `.animate-ping`).
 */
export function Pulse({
  tone = "success",
  animate = true,
  className,
}: {
  tone?: PulseTone;
  animate?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex h-2.5 w-2.5 shrink-0",
        toneText[tone],
        className,
      )}
      aria-hidden="true"
    >
      {animate && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
      )}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
    </span>
  );
}
