import {
  parseWorkflowAssistantId,
  type Run,
  type WorkflowState,
  workflowStateSchema,
} from "@agentic/contracts";

/** "Draft" or "v3", plus the start time. */
export function workflowRunLabel(run: Run): string {
  const draft = parseWorkflowAssistantId(run.assistantId)?.draft ?? false;
  const time = new Date(run.createdAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${draft ? "Draft" : `v${run.assistantVersion}`} · ${time}`;
}

/** Workflow state from checkpoint values, parsed leniently for views. */
export function stateOf(values: unknown): WorkflowState {
  return workflowStateSchema.catch({ input: {}, nodes: {}, output: {} }).parse(values ?? {});
}

/** The run's workflow state (its output is the final state); empty while it hasn't finished. */
export const runState = (run: Run | undefined): WorkflowState => stateOf(run?.output);

/** Total cost of the agent calls the run made, when providers reported it. */
export function runCost(state: WorkflowState): number | null {
  const costs = Object.values(state.nodes).flatMap((n) =>
    n.report?.costUsd != null ? [n.report.costUsd] : [],
  );
  return costs.length > 0 ? costs.reduce((a, b) => a + b, 0) : null;
}

export function runDuration(run: Run): string {
  if (!run.startedAt) return "—";
  const end = run.finishedAt ? Date.parse(run.finishedAt) : Date.now();
  const seconds = Math.max(0, Math.round((end - Date.parse(run.startedAt)) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
