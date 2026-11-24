import { Handle, type NodeProps, Position } from "@xyflow/react";
import { CircleAlert, Eye, LoaderCircle, Repeat } from "lucide-react";
import { cn } from "../../../lib/cn";
import { EntityAvatar } from "../../../patterns/entity-avatar";
import { gateEntity } from "../types";
import type { WorkflowFlowNode } from "./to-flow";

const statusRing: Record<string, string> = {
  running: "ring-2 ring-info",
  waiting: "ring-2 ring-warning",
  succeeded: "ring-2 ring-success",
  failed: "ring-2 ring-danger",
  rejected: "ring-2 ring-danger",
};

const statusText: Record<string, string> = {
  running: "Running",
  waiting: "Needs input",
  succeeded: "Done",
  failed: "Failed",
  rejected: "Rejected",
};

/** A node on the canvas: its agent's color and icon, its id and version, and run status. */
export function WorkflowNodeView({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const { node, target, status, errors, warnings } = data;
  const entity = node.kind === "gate" ? gateEntity : target?.entity;
  const title = node.label || (node.kind === "gate" ? node.title : entity?.name) || node.id;
  const version =
    node.kind === "gate" ? null : node.version === "latest" ? "latest" : `v${node.version}`;
  return (
    <div
      className={cn(
        "flex w-56 items-center gap-2.5 rounded-card border border-border bg-surface px-3 py-2.5 shadow-1",
        selected && "border-accent",
        !node.enabled && "opacity-50",
        status && statusRing[status],
      )}
    >
      <Handle type="target" position={Position.Left} className="bg-fg-subtle!" />
      {entity ? (
        <EntityAvatar
          color={entity.color}
          icon={node.kind === "workflow" ? "workflow" : entity.icon}
        />
      ) : (
        <span className="size-7 shrink-0 rounded-control bg-danger-tint" />
      )}
      <div className="grid min-w-0 flex-1">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate font-mono text-xs text-fg-subtle">
          {node.id}
          {version && ` · ${version}`}
          {status && ` · ${statusText[status]}`}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-fg-subtle [&_svg]:size-3.5">
        {status === "running" && (
          <LoaderCircle aria-label="Running" className="animate-spin text-info" />
        )}
        {(node.reviewInput || node.reviewOutput) && node.kind !== "gate" && (
          <Eye aria-label="Reviewed" />
        )}
        {node.retry && node.retry.maxAttempts > 1 && <Repeat aria-label="Retries" />}
        {errors + warnings > 0 && (
          <CircleAlert
            aria-label={`${errors} errors, ${warnings} warnings`}
            className={errors > 0 ? "text-danger" : "text-warning"}
          />
        )}
      </div>
      <Handle type="source" position={Position.Right} className="bg-fg-subtle!" />
    </div>
  );
}
