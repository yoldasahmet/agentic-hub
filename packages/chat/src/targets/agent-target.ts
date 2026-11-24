import { type AgentRuntimeDeps, agentSubgraph } from "@agentic/agents";
import { type AgentSpec, agentRunReportSchema, type ChatTargetRef } from "@agentic/contracts";
import type { ChatTargetDefinition } from "../deps";
import { withWorkingDir } from "./working-dir";

type Meta = Omit<ChatTargetRef, "kind"> & { description: string };

/**
 * A published agent version as a chat target. A chat's model overrides the
 * agent's model and fallbacks; its working dir overrides the agent's policy.
 */
export function agentTarget(
  meta: Meta,
  spec: AgentSpec,
  runtime: AgentRuntimeDeps,
): ChatTargetDefinition {
  const { description, ...ref } = meta;
  return {
    ref: { kind: "agent", ...ref },
    description,
    inputSchema: spec.inputSchema,
    outputSchema: spec.outputSchema,
    outputFormat: spec.outputFormat,
    model: spec.runtime.model,
    async run(inputs, { model, workingDir }, config) {
      const graph = agentSubgraph(withWorkingDir(spec, workingDir), runtime);
      const result = await graph.invoke({ input: inputs, model }, config);
      return {
        output: result.output ?? {},
        report: agentRunReportSchema.optional().parse(result.report),
      };
    },
  };
}
