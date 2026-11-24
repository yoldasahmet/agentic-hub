import type { Run } from "@agentic/contracts";
import { Button, EmptyState, formatCost, StateDiff, StatusPill } from "@agentic/ui";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, GitCompare } from "lucide-react";
import { useCoreQuery } from "../../../lib/core-queries";
import { runCost, runDuration, runState, workflowRunLabel } from "../runs/run-summary";

/** `/workflows/$workflowId/compare/$a/$b`: two runs side by side, node by node, with output diffs. */
export function CompareRunsPage() {
  const { workflowId, a, b } = useParams({ from: "/workflows/$workflowId/compare/$a/$b" });
  const left = useCoreQuery(["runs", a], (c) => c.runs.get(a)).data;
  const right = useCoreQuery(["runs", b], (c) => c.runs.get(b)).data;
  if (!left || !right) {
    return <EmptyState icon={GitCompare} title="Loading runs…" description="Fetching both runs." />;
  }
  const [l, r] = [runState(left), runState(right)];
  const nodes = [...new Set([...Object.keys(l.nodes), ...Object.keys(r.nodes)])].sort();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button asChild size="icon" variant="ghost" aria-label="Back to workflow">
          <Link to="/workflows/$workflowId" params={{ workflowId }}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <h1 className="flex-1 font-serif text-lg">Compare runs</h1>
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-6 overflow-auto p-4">
        <div className="grid grid-cols-[10rem_1fr_1fr] gap-x-4 gap-y-2">
          <span />
          <RunCell workflowId={workflowId} run={left} />
          <RunCell workflowId={workflowId} run={right} />
          <span className="text-fg-muted">Duration · cost</span>
          <span>{`${runDuration(left)} · ${formatCost(runCost(l))}`}</span>
          <span>{`${runDuration(right)} · ${formatCost(runCost(r))}`}</span>
          {nodes.map((id) => {
            const [x, y] = [l.nodes[id], r.nodes[id]];
            return (
              <div key={id} className="contents">
                <span className="font-mono text-code">{id}</span>
                <NodeCell slot={x} />
                <NodeCell slot={y} />
              </div>
            );
          })}
        </div>
        <section className="grid gap-2">
          <h2 className="font-medium">Input</h2>
          <StateDiff before={l.input} after={r.input} emptyText="Same input." />
        </section>
        <section className="grid gap-2">
          <h2 className="font-medium">Output</h2>
          <StateDiff before={l.output} after={r.output} emptyText="Same output." />
        </section>
        {nodes.map((id) => (
          <section key={id} className="grid gap-2">
            <h2 className="font-medium">
              <span className="font-mono">{id}</span> output
            </h2>
            <StateDiff
              before={l.nodes[id]?.output}
              after={r.nodes[id]?.output}
              emptyText="Same output."
            />
          </section>
        ))}
      </div>
    </div>
  );
}

function RunCell({ workflowId, run }: { workflowId: string; run: Run }) {
  return (
    <Link
      to="/workflows/$workflowId/runs/$runId"
      params={{ workflowId, runId: run.id }}
      className="flex items-center gap-2 hover:underline"
    >
      <StatusPill status={run.status} /> {workflowRunLabel(run)}
    </Link>
  );
}

function NodeCell({ slot }: { slot: ReturnType<typeof runState>["nodes"][string] | undefined }) {
  if (!slot) return <span className="text-fg-subtle">not reached</span>;
  const report = slot.report;
  return (
    <span className="text-sm">
      {slot.status}
      {slot.runs > 1 && ` · ${slot.runs}×`}
      {report && ` · ${formatCost(report.costUsd)} · ${(report.durationMs / 1000).toFixed(1)}s`}
    </span>
  );
}
