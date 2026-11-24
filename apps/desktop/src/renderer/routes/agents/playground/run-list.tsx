import type { Run } from "@agentic/contracts";
import { cn, StatusPill } from "@agentic/ui";
import { runLabel } from "./run-label";

type Props = { runs: Run[]; selectedId: string | undefined; onSelect: (id: string) => void };

/** Recent runs of this agent as a row of chips, newest first. */
export function RunList({ runs, selectedId, onSelect }: Props) {
  if (runs.length === 0) return null;
  return (
    <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Recent runs">
      {runs.map((run) => (
        <li key={run.id}>
          <button
            type="button"
            aria-current={run.id === selectedId}
            onClick={() => onSelect(run.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-control border border-border bg-surface px-2 py-1 text-sm",
              "hover:bg-surface-sunken aria-current:border-accent aria-current:bg-accent-tint",
            )}
          >
            <StatusPill status={run.status} />
            {runLabel(run)}
          </button>
        </li>
      ))}
    </ul>
  );
}
