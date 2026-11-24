import type { Checkpoint } from "@agentic/contracts";
import { Hand } from "lucide-react";
import { cn } from "../../lib/cn";
import { Badge, type BadgeProps } from "../../primitives/badge";

const sourceTone: Record<string, BadgeProps["tone"]> = {
  input: "neutral",
  loop: "success",
  update: "info",
  fork: "accent",
};

/**
 * The node(s) that wrote a checkpoint when the saver recorded them, else
 * where the graph goes next ("→ review"), or "done" at the end.
 */
export function checkpointLabel(checkpoint: Checkpoint): string {
  const nodes = Object.keys(checkpoint.writes ?? {}).filter((n) => !n.startsWith("__"));
  if (nodes.length > 0) return nodes.join(", ");
  if (checkpoint.source === "input") return "input";
  return checkpoint.next.length > 0 ? `→ ${checkpoint.next.join(", ")}` : "done";
}

type Props = {
  checkpoints: Checkpoint[];
  selectedId: string | undefined;
  onSelect: (checkpointId: string) => void;
};

/** Newest first: step, the node that wrote it, its source, and a hand when a gate waits. */
export function CheckpointTimeline({ checkpoints, selectedId, onSelect }: Props) {
  if (checkpoints.length === 0) {
    return <p className="p-3 text-fg-muted">No checkpoints yet. They appear after each step.</p>;
  }
  return (
    <ol className="grid">
      {checkpoints.map((checkpoint) => (
        <li key={checkpoint.checkpointId}>
          <button
            type="button"
            aria-current={checkpoint.checkpointId === selectedId}
            onClick={() => onSelect(checkpoint.checkpointId)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-sunken",
              checkpoint.checkpointId === selectedId && "bg-surface-sunken",
            )}
          >
            <span className="w-6 font-mono text-code text-fg-subtle">{checkpoint.step}</span>
            <span className="min-w-0 flex-1 truncate">{checkpointLabel(checkpoint)}</span>
            {checkpoint.interrupts.length > 0 && (
              <Hand aria-label="Waiting for input" className="size-3.5 text-warning-ink" />
            )}
            <Badge tone={sourceTone[checkpoint.source] ?? "neutral"}>{checkpoint.source}</Badge>
          </button>
        </li>
      ))}
    </ol>
  );
}
