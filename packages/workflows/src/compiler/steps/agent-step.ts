import { agentNode } from "@agentic/agents";
import { type AgentWorkflowNode, AppError, agentStreamEventSchema } from "@agentic/contracts";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { projectInput } from "../../bindings";
import { pinned, refKey } from "../../resolve";
import { emit, namespaceOf, type StepContext, scopeOf } from "./context";
import { jsonRecord } from "./json";
import { nodeStep } from "./node-step";

/**
 * An agent node runs the agent's own generic node (packages/agents) on the
 * projected input, so a workflow step behaves exactly like the playground.
 * Its stream events are tagged with the workflow node.
 */
export function agentStep(ctx: StepContext, node: AgentWorkflowNode) {
  const spec = ctx.resolved.agents.get(refKey(node.agentId, pinned(node.version, node.id)));
  if (!spec) throw new AppError("internal", `"${node.id}" was compiled without its agent`);
  const run = agentNode(() => spec, ctx.deps);
  return nodeStep(ctx, node, async (state, config) => {
    const input = state.overrides[node.id] ?? projectInput(node.bindings, scopeOf(state));
    const result = await run(
      {
        input: jsonRecord(input),
        model: undefined,
        spec: undefined,
        output: undefined,
        report: undefined,
      },
      tagEvents(config, node.id),
    );
    return { output: result.output ?? {}, report: result.report };
  });
}

function tagEvents(config: LangGraphRunnableConfig, node: string): LangGraphRunnableConfig {
  const ns = namespaceOf(config);
  return {
    ...config,
    writer: (chunk: unknown) => {
      const event = agentStreamEventSchema.safeParse(chunk);
      if (event.success) emit(config, { kind: "workflow.agent", node, ns, event: event.data });
    },
  };
}
