import type { RunEvent } from "@agentic/contracts";
import { Ban, CircleCheck, CircleX, Hand, LoaderCircle, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { EventStream } from "../../patterns/event-stream/event-stream";
import type { LiveStatus } from "../workflow/types";
import { turnView } from "./turn-events";

const nodeStyles: Record<LiveStatus, { icon: LucideIcon; label: string; tone: string }> = {
  running: { icon: LoaderCircle, label: "running", tone: "bg-info-tint text-info-ink" },
  waiting: { icon: Hand, label: "waiting", tone: "bg-warning-tint text-warning-ink" },
  succeeded: { icon: CircleCheck, label: "done", tone: "bg-success-tint text-success-ink" },
  failed: { icon: CircleX, label: "failed", tone: "bg-danger-tint text-danger-ink" },
  rejected: { icon: Ban, label: "rejected", tone: "bg-danger-tint text-danger-ink" },
};

export type TurnProgressProps = {
  events: RunEvent[];
  /** Whether the run is still going (shows the step spinner). */
  active: boolean;
  /** Nodes whose gate waits right now. */
  waitingNodes?: string[];
  providerNames?: Record<string, string>;
};

/**
 * The answer being made: the current step, a workflow's node progress,
 * and the target's streamed text and tool calls. Rows only append, so
 * streaming never shifts what is above.
 */
export function TurnProgress({
  events,
  active,
  waitingNodes = [],
  providerNames,
}: TurnProgressProps) {
  const view = turnView(events);
  const nodes = view.nodes.map((n) =>
    waitingNodes.includes(n.node) ? { ...n, status: "waiting" as const } : n,
  );
  return (
    <div className="grid gap-2" aria-live="polite">
      {active && view.step && (
        <p className="flex items-center gap-1.5 text-sm text-fg-muted">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> {view.step}…
        </p>
      )}
      {nodes.length > 0 && (
        <ol className="flex flex-wrap gap-1.5" aria-label="Workflow progress">
          {nodes.map(({ node, status }) => {
            const { icon: Icon, label, tone } = nodeStyles[status];
            return (
              <li
                key={node}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                  tone,
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-3", status === "running" && active && "animate-spin")}
                />
                <span className="font-mono">{node}</span> · {label}
              </li>
            );
          })}
        </ol>
      )}
      {view.stream.length > 0 && <EventStream events={view.stream} providerNames={providerNames} />}
    </div>
  );
}
