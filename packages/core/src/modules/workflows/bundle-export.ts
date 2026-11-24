import {
  type AgentBundle,
  AppError,
  type BundleNode,
  type Workflow,
  type WorkflowBundle,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import type { AgentModule } from "../agents/index";
import { toBundle } from "../agents/library";
import { type BundleTools, collectCapabilities } from "./bundle-capabilities";
import type { WorkflowService } from "./service";

/**
 * The draft as a portable bundle: ids become slugs, and the agents, skills,
 * and MCP servers it uses travel with it.
 */
export async function toWorkflowBundle(
  ctx: LocalContext,
  workflow: Workflow,
  agents: AgentModule,
  workflows: WorkflowService,
  tools: BundleTools,
): Promise<WorkflowBundle> {
  const bundled = new Map<string, AgentBundle>();
  const nodes: BundleNode[] = [];
  for (const node of workflow.draft.nodes) {
    if (node.kind === "agent") {
      const { agentId, version: _version, ...rest } = node;
      const agent = await agents.service.get(ctx, agentId).catch(() => undefined);
      if (!agent)
        throw new AppError("not_found", `"${node.id}" uses an agent that no longer exists`);
      bundled.set(agent.slug, toBundle(agent));
      nodes.push({ ...rest, agent: agent.slug });
    } else if (node.kind === "workflow") {
      const { workflowId, version: _version, ...rest } = node;
      nodes.push({ ...rest, workflow: (await workflows.get(ctx, workflowId)).slug });
    } else {
      nodes.push(node);
    }
  }
  const agentBundles = [...bundled.values()];
  return {
    format: "agentic.workflow",
    formatVersion: 1,
    workflow: {
      slug: workflow.slug,
      name: workflow.name,
      description: workflow.description,
      color: workflow.color,
      icon: workflow.icon,
      document: { ...workflow.draft, nodes },
    },
    agents: agentBundles,
    ...(await collectCapabilities(ctx, agentBundles, tools)),
  };
}
