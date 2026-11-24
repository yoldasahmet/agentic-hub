import { AppError, type SubworkflowNode } from "@agentic/contracts";
import { projectInput } from "../../bindings";
import { pinned, type ResolvedWorkflow, refKey } from "../../resolve";
import { type StepContext, scopeOf } from "./context";
import { jsonRecord } from "./json";
import { nodeStep } from "./node-step";

/** Compiles a child workflow into a graph; supplied by the compiler to avoid an import cycle. */
export type ChildCompiler = (resolved: ResolvedWorkflow) => {
  invoke(input: unknown, config: unknown): Promise<{ output?: Record<string, unknown> }>;
};

/**
 * A subworkflow runs as a LangGraph subgraph inside this node. It shares
 * the parent's checkpointer under its own namespace, so its gates pause the
 * parent run and resume it where they left off.
 */
export function subworkflowStep(ctx: StepContext, node: SubworkflowNode, compile: ChildCompiler) {
  const child = ctx.resolved.workflows.get(refKey(node.workflowId, pinned(node.version, node.id)));
  if (!child) throw new AppError("internal", `"${node.id}" was compiled without its workflow`);
  const graph = compile(child);
  return nodeStep(ctx, node, async (state, config) => {
    const input = state.overrides[node.id] ?? projectInput(node.bindings, scopeOf(state));
    const result = await graph.invoke({ input: jsonRecord(input) }, config);
    return { output: result.output ?? {} };
  });
}
