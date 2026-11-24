import type { AgentRuntimeDeps } from "@agentic/agents";
import { type AgentRunReport, type ChatTargetRef, workflowStateSchema } from "@agentic/contracts";
import { addUsage } from "@agentic/llm";
import { buildWorkflowGraph, type ResolvedWorkflow } from "@agentic/workflows";
import type { ChatTargetDefinition } from "../deps";
import { withWorkingDir } from "./working-dir";

type Meta = Omit<ChatTargetRef, "kind"> & { description: string };

/**
 * A published workflow version as a chat target. Its node progress and
 * agent streams reach the chat run as `custom` events, and its gates
 * become the chat run's interrupts.
 */
export function workflowTarget(
  meta: Meta,
  resolved: ResolvedWorkflow,
  runtime: AgentRuntimeDeps,
): ChatTargetDefinition {
  const { description, ...ref } = meta;
  const doc = resolved.document;
  return {
    ref: { kind: "workflow", ...ref },
    description,
    inputSchema: doc.inputSchema,
    outputSchema: doc.outputSchema,
    outputFormat: "markdown",
    async run(inputs, { workingDir }, config) {
      const graph = buildWorkflowGraph(retarget(resolved, workingDir), runtime).compile();
      const result = await graph.invoke({ input: inputs }, config);
      const state = workflowStateSchema.parse(result);
      return { output: state.output, report: sumReports(Object.values(state.nodes)) };
    },
  };
}

function retarget(resolved: ResolvedWorkflow, workingDir: string | null): ResolvedWorkflow {
  if (!workingDir) return resolved;
  return {
    document: resolved.document,
    agents: new Map(
      [...resolved.agents].map(([key, spec]) => [key, withWorkingDir(spec, workingDir)]),
    ),
    workflows: new Map(
      [...resolved.workflows].map(([key, child]) => [key, retarget(child, workingDir)]),
    ),
  };
}

/** One report for the whole run: usage and cost added up over the nodes that called a model. */
function sumReports(slots: Array<{ report?: AgentRunReport }>): AgentRunReport | undefined {
  const reports = slots.flatMap((slot) => (slot.report ? [slot.report] : []));
  if (reports.length === 0) return undefined;
  return reports.reduce((total, r) => ({
    usage: addUsage(total.usage, r.usage),
    costUsd:
      total.costUsd === null && r.costUsd === null ? null : (total.costUsd ?? 0) + (r.costUsd ?? 0),
    durationMs: total.durationMs + r.durationMs,
    attempts: total.attempts + r.attempts,
  }));
}
