import type { RunStatus } from "@agentic/contracts";
import {
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  Hand,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/cn";

const statusStyles: Record<RunStatus, { label: string; icon: LucideIcon; className: string }> = {
  queued: { label: "Queued", icon: CircleDashed, className: "bg-surface-sunken text-fg-muted" },
  running: { label: "Running", icon: LoaderCircle, className: "bg-info-tint text-info-ink" },
  waiting: { label: "Needs input", icon: Hand, className: "bg-warning-tint text-warning-ink" },
  succeeded: {
    label: "Succeeded",
    icon: CircleCheck,
    className: "bg-success-tint text-success-ink",
  },
  failed: { label: "Failed", icon: CircleX, className: "bg-danger-tint text-danger-ink" },
  canceled: { label: "Canceled", icon: CircleSlash, className: "bg-surface-sunken text-fg-muted" },
};

/** Status as icon + label, never color alone. */
export function StatusPill({ status, className }: { status: RunStatus; className?: string }) {
  const { label, icon: Icon, className: tone } = statusStyles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className={cn("size-3", status === "running" && "animate-spin")} />
      {label}
    </span>
  );
}
