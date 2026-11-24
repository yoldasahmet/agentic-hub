import type { Run, Workflow } from "@agentic/contracts";
import { Button, EntityChip, formatCost, StatusPill } from "@agentic/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, RotateCcw, Square } from "lucide-react";
import { showError } from "../../../lib/show-error";
import { useCancelRun, useRetryRun } from "../queries";
import { runCost, runDuration, runState, workflowRunLabel } from "../runs/run-summary";

/** Which run this is, how it went, and cancel or retry. */
export function RunHeader({ workflow, run }: { workflow: Workflow; run: Run }) {
  const navigate = useNavigate();
  const cancel = useCancelRun();
  const retry = useRetryRun();
  const active = run.status === "queued" || run.status === "running" || run.status === "waiting";
  const retryable = run.status === "failed" || run.status === "canceled";
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-3">
      <Button asChild size="icon" variant="ghost" aria-label="Back to workflow">
        <Link to="/workflows/$workflowId" params={{ workflowId: workflow.id }}>
          <ArrowLeft aria-hidden />
        </Link>
      </Button>
      <EntityChip entity={workflow} />
      <StatusPill status={run.status} />
      <span className="text-fg-muted">{workflowRunLabel(run)}</span>
      <span className="font-mono text-code text-fg-subtle">run {run.id.slice(-8)}</span>
      <span className="flex-1 text-sm text-fg-muted">
        {runDuration(run)} · {formatCost(runCost(runState(run)))}
      </span>
      {run.error && (
        <span className="max-w-xs truncate text-sm text-danger-ink">{run.error.message}</span>
      )}
      {active && (
        <Button onClick={() => cancel.mutate(run.id, { onError: (err) => showError(err) })}>
          <Square aria-hidden /> Cancel
        </Button>
      )}
      {retryable && (
        <Button
          variant="primary"
          disabled={retry.isPending}
          onClick={() =>
            retry.mutate(
              { runId: run.id, input: {} },
              {
                onSuccess: (next) =>
                  void navigate({
                    to: "/workflows/$workflowId/runs/$runId",
                    params: { workflowId: workflow.id, runId: next.id },
                  }),
                onError: (err) => showError(err),
              },
            )
          }
        >
          <RotateCcw aria-hidden /> Retry failed node
        </Button>
      )}
    </header>
  );
}
