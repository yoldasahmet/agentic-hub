import type { Workflow } from "@agentic/contracts";
import { Button, EmptyState, formatCost, StatusPill } from "@agentic/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { GitCompare, History } from "lucide-react";
import { useState } from "react";
import { useWorkflowRuns } from "../queries";
import { runCost, runDuration, runState, workflowRunLabel } from "./run-summary";

/** This workflow's runs, newest first. Tick two to compare them. */
export function RunsTab({ workflow }: { workflow: Workflow }) {
  const navigate = useNavigate();
  const runs = useWorkflowRuns(workflow.id).data ?? [];
  const [picked, setPicked] = useState<string[]>([]);
  if (runs.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No runs yet"
        description="Start one with Run; it shows up here."
      />
    );
  }
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-2),
    );
  const [a, b] = picked;
  return (
    <div className="grid gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-fg-muted">{runs.length} recent runs</p>
        <Button
          disabled={!a || !b}
          onClick={() =>
            a &&
            b &&
            void navigate({
              to: "/workflows/$workflowId/compare/$a/$b",
              params: { workflowId: workflow.id, a, b },
            })
          }
        >
          <GitCompare aria-hidden /> Compare {picked.length}/2
        </Button>
      </div>
      <table className="w-full text-left">
        <thead className="text-sm text-fg-subtle">
          <tr>
            <th className="w-8 py-1" aria-label="Compare" />
            <th className="py-1">Status</th>
            <th className="py-1">Run</th>
            <th className="py-1">Duration</th>
            <th className="py-1">Cost</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-border">
              <td className="py-2">
                <input
                  type="checkbox"
                  aria-label={`Compare run ${run.id.slice(-6)}`}
                  checked={picked.includes(run.id)}
                  onChange={() => toggle(run.id)}
                />
              </td>
              <td className="py-2">
                <StatusPill status={run.status} />
              </td>
              <td className="py-2">
                <Link
                  to="/workflows/$workflowId/runs/$runId"
                  params={{ workflowId: workflow.id, runId: run.id }}
                  className="text-accent-ink hover:underline"
                >
                  {workflowRunLabel(run)}
                </Link>
                <span className="ml-2 font-mono text-xs text-fg-subtle">{run.id.slice(-8)}</span>
              </td>
              <td className="py-2 text-fg-muted">{runDuration(run)}</td>
              <td className="py-2 text-fg-muted">{formatCost(runCost(runState(run)))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
