import {
  type Agent,
  AppError,
  type Workflow,
  type WorkflowBundle,
  type WorkflowDocument,
  workflowDocumentSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { layoutDocument, needsLayout } from "@agentic/workflows";
import type { AgentModule } from "../agents/index";
import { type BundleTools, installCapabilities } from "./bundle-capabilities";
import type { WorkflowService } from "./service";

/**
 * Turns a bundle into a workflow in this workspace. Agents are matched by
 * slug; missing ones are installed from the bundle or the built-ins and
 * published, so the workflow's `latest` pins resolve. Missing skills and
 * MCP servers come from the bundle. Subworkflows must already exist (by slug).
 */
export class BundleInstaller {
  constructor(
    private readonly workflows: WorkflowService,
    private readonly agents: AgentModule,
    private readonly tools: BundleTools,
  ) {}

  async install(ctx: LocalContext, bundle: WorkflowBundle): Promise<Workflow> {
    const { document, ...identity } = bundle.workflow;
    await installCapabilities(ctx, bundle, this.tools);
    const agentIds = new Map<string, string>();
    const workflowIds = new Map<string, string>();
    for (const node of document.nodes) {
      if (node.kind === "agent" && !agentIds.has(node.agent)) {
        agentIds.set(node.agent, (await this.agent(ctx, bundle, node.agent)).id);
      }
      if (node.kind === "workflow" && !workflowIds.has(node.workflow)) {
        workflowIds.set(node.workflow, await this.subworkflow(ctx, node.workflow));
      }
    }
    const nodes = document.nodes.map((node) => {
      if (node.kind === "agent") {
        const { agent, ...rest } = node;
        return { ...rest, agentId: agentIds.get(agent), version: "latest" };
      }
      if (node.kind === "workflow") {
        const { workflow, ...rest } = node;
        return { ...rest, workflowId: workflowIds.get(workflow), version: "latest" };
      }
      return node;
    });
    const parsed: WorkflowDocument = workflowDocumentSchema.parse({ ...document, nodes });
    return this.workflows.create(ctx, {
      ...identity,
      document: needsLayout(parsed) ? layoutDocument(parsed) : parsed,
    });
  }

  private async agent(ctx: LocalContext, bundle: WorkflowBundle, slug: string): Promise<Agent> {
    let agent = await this.agents.directory.bySlug(ctx, slug);
    if (!agent) {
      const source = bundle.agents.find((b) => b.agent.slug === slug);
      agent = source
        ? await this.agents.library.install(ctx, source)
        : await this.agents.library.installBuiltin(ctx, slug);
    } else {
      await this.agents.library.ensureSkills(ctx, agent.draft);
    }
    if (agent.latestVersion === null) {
      await this.agents.service.publish(ctx, agent.id, agent.revision);
    }
    return agent;
  }

  private async subworkflow(ctx: LocalContext, slug: string): Promise<string> {
    const found = (await this.workflows.list(ctx, {})).find((w) => w.slug === slug);
    if (!found) throw new AppError("not_found", `Import the workflow "${slug}" first`);
    return found.id;
  }
}
