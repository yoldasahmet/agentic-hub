import type { Thread, ThreadStatus } from "@agentic/contracts";
import { Badge, type BadgeProps, cn } from "@agentic/ui";
import { AssistantLabel } from "./assistant-label";

const statusBadge: Record<ThreadStatus, { label: string; tone: BadgeProps["tone"] }> = {
  idle: { label: "Idle", tone: "neutral" },
  busy: { label: "Running", tone: "info" },
  interrupted: { label: "Needs input", tone: "warning" },
  error: { label: "Failed", tone: "danger" },
};

type Props = { threads: Thread[]; selectedId: string | undefined; onSelect: (id: string) => void };

/** Threads, most recently updated first. */
export function ThreadList({ threads, selectedId, onSelect }: Props) {
  return (
    <ul className="grid">
      {threads.map((thread) => {
        const badge = statusBadge[thread.status];
        return (
          <li key={thread.id}>
            <button
              type="button"
              aria-current={thread.id === selectedId}
              onClick={() => onSelect(thread.id)}
              className={cn(
                "grid w-full gap-0.5 border-b border-border px-3 py-2 text-left hover:bg-surface-sunken",
                thread.id === selectedId && "bg-surface-sunken",
              )}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">
                  <AssistantLabel
                    assistantId={thread.assistantId}
                    version={thread.assistantVersion}
                  />
                </span>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </span>
              <span className="flex gap-2 font-mono text-code text-fg-subtle">
                {thread.id.slice(-8)}
                {thread.forkedFrom && <span>fork of {thread.forkedFrom.threadId.slice(-8)}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
