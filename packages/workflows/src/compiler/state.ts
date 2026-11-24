import type { JsonValue, NodeSlot } from "@agentic/contracts";
import { Annotation } from "@langchain/langgraph";

const merge = <T>(current: Record<string, T>, update: Record<string, T>) => ({
  ...current,
  ...update,
});

/** `null` removes a key: review overrides are consumed once. */
const mergeOverrides = (
  current: Record<string, Record<string, unknown>>,
  update: Record<string, Record<string, unknown> | null>,
) => {
  const next = { ...current };
  for (const [key, value] of Object.entries(update)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next;
};

/**
 * The channels of a workflow thread. Parallel branches write different
 * keys of `nodes` and `output` in the same step, so both merge.
 * - `input`: the run input.
 * - `nodes`: each node's last status, output, run count, and report.
 * - `overrides`: inputs a reviewer edited, read by the node's next run.
 * - `output`: the workflow output, re-mapped after every node.
 */
export const WorkflowGraphState = Annotation.Root({
  input: Annotation<Record<string, JsonValue>>({
    reducer: (_current, update) => update,
    default: () => ({}),
  }),
  nodes: Annotation<Record<string, NodeSlot>>({ reducer: merge, default: () => ({}) }),
  overrides: Annotation<
    Record<string, Record<string, unknown>>,
    Record<string, Record<string, unknown> | null>
  >({ reducer: mergeOverrides, default: () => ({}) }),
  output: Annotation<Record<string, unknown>>({ reducer: merge, default: () => ({}) }),
});
export type WorkflowValues = typeof WorkflowGraphState.State;
export type WorkflowUpdate = typeof WorkflowGraphState.Update;
