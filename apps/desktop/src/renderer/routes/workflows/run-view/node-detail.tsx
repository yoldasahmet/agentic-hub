import type { NodeSlot, RunEvent, WorkflowNode } from "@agentic/contracts";
import {
  Button,
  EntityAvatar,
  EventStream,
  gateEntity,
  JsonView,
  type LiveStatus,
  type TargetLookup,
  UsageSummary,
} from "@agentic/ui";
import { RotateCcw } from "lucide-react";
import { nodeEvents } from "./live-status";

type Props = {
  node: WorkflowNode;
  slot: NodeSlot | undefined;
  status: LiveStatus | undefined;
  events: RunEvent[];
  lookup: TargetLookup;
  /** Set when the run has stopped: forks it and runs again from just before this node. */
  onRetryFrom?: () => void;
};

/** One node of a run: status, cost, output, and its own event stream. */
export function NodeDetail({ node, slot, status, events, lookup, onRetryFrom }: Props) {
  const entity = node.kind === "gate" ? gateEntity : lookup(node)?.entity;
  const report = slot?.report;
  return (
    <div className="grid gap-4">
      <header className="flex items-center gap-2">
        {entity && (
          <EntityAvatar
            color={entity.color}
            icon={node.kind === "workflow" ? "workflow" : entity.icon}
          />
        )}
        <div className="grid min-w-0 flex-1">
          <span className="truncate font-medium">{node.label || entity?.name || node.id}</span>
          <span className="font-mono text-xs text-fg-subtle">
            {node.id} · {status ?? "not reached"}
            {slot && slot.runs > 1 ? ` · ran ${slot.runs}×` : ""}
          </span>
        </div>
        {onRetryFrom && (
          <Button size="sm" onClick={onRetryFrom}>
            <RotateCcw aria-hidden /> Retry from here
          </Button>
        )}
      </header>
      {report && (
        <UsageSummary
          usage={report.usage}
          costUsd={report.costUsd}
          durationMs={report.durationMs}
        />
      )}
      {slot && (
        <section className="grid gap-1.5">
          <h3 className="text-sm font-medium">Output</h3>
          <JsonView value={slot.output} />
        </section>
      )}
      <section className="grid gap-1.5">
        <h3 className="text-sm font-medium">Events</h3>
        <EventStream events={nodeEvents(events, node.id)} />
      </section>
    </div>
  );
}
