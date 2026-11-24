import type { Interrupt, Run } from "@agentic/contracts";
import { Button, StatusPill } from "@agentic/ui";
import { PendingGates } from "../../components/pending-gates";
import { showError } from "../../lib/show-error";
import { useCancelRun } from "./queries";

/** The thread's latest run: status, cancel, and its gates while it waits. */
export function RunHeader({ run, interrupts }: { run: Run; interrupts: Interrupt[] }) {
  const cancel = useCancelRun();
  const active = run.status === "queued" || run.status === "running" || run.status === "waiting";
  const onError = (err: Error) => showError(err);

  return (
    <div className="grid gap-3 rounded-card border border-border bg-surface p-3 shadow-1">
      <div className="flex items-center gap-2">
        <StatusPill status={run.status} />
        <span className="font-mono text-code text-fg-subtle" data-selectable>
          run {run.id.slice(-8)}
        </span>
        <span className="flex-1" />
        {active && (
          <Button
            size="sm"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(run.id, { onError })}
          >
            Cancel
          </Button>
        )}
      </div>
      {run.error && (
        <p role="alert" className="rounded-control bg-danger-tint p-2 text-sm text-danger-ink">
          {run.error.message}
        </p>
      )}
      {run.status === "waiting" && <PendingGates runId={run.id} interrupts={interrupts} />}
    </div>
  );
}
