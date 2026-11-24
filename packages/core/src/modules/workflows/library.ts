import {
  type AgentExport,
  AppError,
  type BundleFormat,
  type ImportAgentInput,
  type Workflow,
  type WorkflowTemplate,
  workflowBundleSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { workflowTemplates } from "@agentic/workflows";
import { stringify as stringifyYaml } from "yaml";
import { parseBundleFile } from "../../lib/bundle-file";
import type { AgentModule } from "../agents/index";
import type { BundleTools } from "./bundle-capabilities";
import { toWorkflowBundle } from "./bundle-export";
import { BundleInstaller } from "./bundle-installer";
import type { WorkflowService } from "./service";

/** Templates, export and import (JSON or YAML), and duplicate. */
export class WorkflowLibrary {
  private readonly installer: BundleInstaller;

  constructor(
    private readonly workflows: WorkflowService,
    private readonly agents: AgentModule,
    private readonly tools: BundleTools,
  ) {
    this.installer = new BundleInstaller(workflows, agents, tools);
  }

  async templates(ctx: LocalContext): Promise<WorkflowTemplate[]> {
    const slugs = new Set((await this.workflows.list(ctx, {})).map((w) => w.slug));
    return workflowTemplates.map(({ workflow }) => ({
      slug: workflow.slug,
      name: workflow.name,
      description: workflow.description,
      color: workflow.color,
      icon: workflow.icon,
      nodes: workflow.document.nodes.length,
      installed: slugs.has(workflow.slug),
    }));
  }

  /**
   * Installs the template with the agents (published, so it can run at
   * once), skills, and MCP servers it uses.
   */
  async installTemplate(ctx: LocalContext, slug: string): Promise<Workflow> {
    const bundle = workflowTemplates.find((t) => t.workflow.slug === slug);
    if (!bundle) throw new AppError("not_found", `No workflow template ${slug}`);
    return this.installer.install(ctx, bundle);
  }

  async export(ctx: LocalContext, id: string, format: BundleFormat): Promise<AgentExport> {
    const workflow = await this.workflows.get(ctx, id);
    const bundle = await toWorkflowBundle(ctx, workflow, this.agents, this.workflows, this.tools);
    const content =
      format === "yaml" ? stringifyYaml(bundle) : `${JSON.stringify(bundle, null, 2)}\n`;
    return { filename: `${workflow.slug}.workflow.${format}`, content };
  }

  async import(ctx: LocalContext, input: ImportAgentInput): Promise<Workflow> {
    return this.installer.install(
      ctx,
      parseBundleFile(input, workflowBundleSchema, "a workflow bundle"),
    );
  }

  async duplicate(ctx: LocalContext, id: string): Promise<Workflow> {
    const workflow = await this.workflows.get(ctx, id);
    return this.workflows.create(ctx, {
      name: `${workflow.name} copy`,
      description: workflow.description,
      color: workflow.color,
      icon: workflow.icon,
      slug: workflow.slug,
      document: workflow.draft,
    });
  }
}
