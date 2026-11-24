import {
  type AgentRunReport,
  AppError,
  type NodeSlot,
  type WorkflowNode,
} from "@agentic/contracts";
import { isGraphBubbleUp, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { mapOutput } from "../output";
import type { WorkflowUpdate, WorkflowValues } from "../state";
import { emit, namespaceOf, type StepContext } from "./context";

export type StepResult = {
  output: Record<string, unknown>;
  report?: AgentRunReport;
  status?: NodeSlot["status"];
};
export type StepBody = (
  state: WorkflowValues,
  config: LangGraphRunnableConfig,
) => Promise<StepResult>;

/**
 * Wraps what a node does with what every node needs: status events,
 * retries with backoff (never for gates, cancels, or interrupts), the
 * `nodes` slot, the re-mapped workflow output, and errors tagged with the
 * node so the run view can point at it.
 */
export function nodeStep(ctx: StepContext, node: WorkflowNode, body: StepBody) {
  const maxAttempts = node.retry?.maxAttempts ?? 1;
  const backoffMs = node.retry?.backoffMs ?? 0;
  return async (
    state: WorkflowValues,
    config: LangGraphRunnableConfig,
  ): Promise<WorkflowUpdate> => {
    const ns = namespaceOf(config);
    const startedAt = new Date().toISOString();
    for (let attempt = 1; ; attempt++) {
      emit(config, { kind: "workflow.node", node: node.id, ns, status: "running", attempt });
      try {
        const result = await body(state, config);
        const slot: NodeSlot = {
          status: result.status ?? "succeeded",
          output: result.output,
          runs: (state.nodes[node.id]?.runs ?? 0) + 1,
          report: result.report,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
        emit(config, { kind: "workflow.node", node: node.id, ns, status: slot.status, attempt });
        const update: WorkflowUpdate = {
          nodes: { [node.id]: slot },
          output: mapOutput(ctx.doc, ctx.topo, state, node.id, slot),
        };
        if (state.overrides[node.id]) update.overrides = { [node.id]: null };
        return update;
      } catch (err) {
        if (isGraphBubbleUp(err)) throw err;
        const error = tagged(err, node.id);
        const status = error.code === "workflow.rejected" ? "rejected" : "failed";
        emit(config, {
          kind: "workflow.node",
          node: node.id,
          ns,
          status,
          attempt,
          error: error.toJSON(),
        });
        if (config.signal?.aborted || status === "rejected" || attempt >= maxAttempts) throw error;
        await sleep(backoffMs * 2 ** (attempt - 1), config.signal);
      }
    }
  };
}

/** Keeps the original code and details, adding which node failed. */
function tagged(err: unknown, node: string): AppError {
  const error = AppError.from(err);
  const details = isObject(error.details)
    ? { ...error.details, node }
    : { node, cause: error.details };
  return new AppError(error.code, error.message, details);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
