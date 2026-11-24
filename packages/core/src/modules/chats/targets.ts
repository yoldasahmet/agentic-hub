import type { AgentRuntimeDeps } from "@agentic/agents";
import {
  agentTarget,
  type CatalogEntry,
  type ChatTargetDefinition,
  type ChatTargets,
  workflowTarget,
} from "@agentic/chat";
import {
  AppError,
  type ChatTarget,
  type IdentityColor,
  type IdentityIcon,
  type JsonSchema,
  schemaToFields,
} from "@agentic/contracts";
import type { AgentDirectory } from "../agents/directory";
import type { WorkflowDirectory } from "../workflows/directory";

type Target = Exclude<ChatTarget, { kind: "app" }>;
type Summary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: IdentityColor;
  icon: IdentityIcon;
  workspaceId: string;
  archived: boolean;
  latestVersion: number | null;
};

/** Compiled targets are pinned versions, so the cache only needs a size bound. */
const MAX_CACHED = 128;

/**
 * Chat targets from the agents and workflows modules: the latest
 * published version of each, checked against the chat's workspace.
 */
export class ChatTargetDirectory implements ChatTargets {
  private readonly cache = new Map<string, ChatTargetDefinition>();

  constructor(
    private readonly agents: AgentDirectory,
    private readonly workflows: WorkflowDirectory,
    private readonly runtime: AgentRuntimeDeps,
  ) {}

  async resolve(target: Target, workspaceId: string): Promise<ChatTargetDefinition> {
    const { summary, version } = published(
      target,
      target.kind === "agent"
        ? await this.agents.find(target.id)
        : await this.workflows.find(target.id),
      workspaceId,
    );
    const key = `${target.kind}:${target.id}@${version}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const definition = await this.build(target, summary, version);
    if (this.cache.size >= MAX_CACHED) this.cache.clear();
    this.cache.set(key, definition);
    return definition;
  }

  async catalog(workspaceId: string): Promise<CatalogEntry[]> {
    const agents = await this.agents.published(workspaceId);
    const workflows = await this.workflows.published(workspaceId);
    const entries: CatalogEntry[] = [];
    for (const agent of agents) {
      const spec = await this.agents.spec(agent.id, agent.latestVersion ?? 1);
      entries.push(entry("agent", agent, spec?.inputSchema));
    }
    for (const workflow of workflows) {
      const doc = await this.workflows.document(workflow.id, workflow.latestVersion ?? 1);
      entries.push(entry("workflow", workflow, doc?.inputSchema));
    }
    return entries;
  }

  private async build(
    target: Target,
    summary: Summary,
    version: number,
  ): Promise<ChatTargetDefinition> {
    const meta = {
      id: summary.id,
      version,
      name: summary.name,
      color: summary.color,
      icon: summary.icon,
      description: summary.description,
    };
    if (target.kind === "agent") {
      const spec = await this.agents.spec(target.id, version);
      if (!spec) throw new AppError("not_found", `${summary.name} has no version ${version}`);
      return agentTarget(meta, spec, this.runtime);
    }
    const doc = await this.workflows.document(target.id, version);
    if (!doc) throw new AppError("not_found", `${summary.name} has no version ${version}`);
    return workflowTarget(meta, await this.workflows.resolve(target.id, doc), this.runtime);
  }
}

/** The version a chat runs: the latest published one, in the chat's workspace. */
function published(
  target: Target,
  summary: Summary | undefined,
  workspaceId: string,
): { summary: Summary; version: number } {
  if (!summary || summary.workspaceId !== workspaceId) {
    throw new AppError("not_found", `This chat's ${target.kind} no longer exists`);
  }
  if (summary.archived) throw new AppError("conflict", `${summary.name} is archived`);
  if (summary.latestVersion === null) {
    throw new AppError("conflict", `Publish ${summary.name} to chat with it`);
  }
  return { summary, version: summary.latestVersion };
}

function entry(
  kind: CatalogEntry["kind"],
  s: Summary,
  schema: JsonSchema | undefined,
): CatalogEntry {
  const inputs = schemaToFields(schema ?? {}).map(
    (f) => `${f.name}${f.required ? "*" : ""}: ${f.type}`,
  );
  return { kind, id: s.id, name: s.name, slug: s.slug, description: s.description, inputs };
}
