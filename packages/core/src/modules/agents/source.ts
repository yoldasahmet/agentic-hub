import {
  AGENT_NODE,
  type AgentRuntimeDeps,
  agentDraftDefinition,
  agentVersionDefinition,
} from "@agentic/agents";
import {
  type AgentSpec,
  AppError,
  type Assistant,
  parseAgentAssistantId,
} from "@agentic/contracts";
import type { AssistantDefinition, AssistantSource } from "@agentic/graph";
import { toAgentVersion } from "./mappers";
import type { AgentRepository } from "./repository";

/** Draft runs carry their spec, so the draft assistant has one fixed version. */
const DRAFT_VERSION = 1;

/**
 * Resolves `agent:<id>` (published versions) and `agent-draft:<id>` from
 * the DB, so a version another app instance published runs here too.
 */
export class AgentAssistantSource implements AssistantSource {
  constructor(
    private readonly repo: AgentRepository,
    private readonly deps: AgentRuntimeDeps,
  ) {}

  matches(id: string): boolean {
    return parseAgentAssistantId(id) !== undefined;
  }

  async latest(id: string, workspaceId: string): Promise<Assistant> {
    const { agent, draft } = await this.load(id);
    if (agent.workspaceId !== workspaceId) throw notFound(id);
    if (agent.archivedAt) throw new AppError("conflict", `Agent ${agent.name} is archived`);
    if (!draft && agent.latestVersion === null) {
      throw new AppError("conflict", `Agent ${agent.name} has no published version`);
    }
    const version = draft ? DRAFT_VERSION : (agent.latestVersion ?? DRAFT_VERSION);
    return { ...meta(agent, id, version, draft), nodes: [AGENT_NODE] };
  }

  async definition(id: string, version: number): Promise<AssistantDefinition> {
    const { agent, agentId, draft } = await this.load(id);
    if (draft) return agentDraftDefinition(meta(agent, id, DRAFT_VERSION, true), this.deps);
    const row = await this.repo.getVersion(agentId, version);
    if (!row) throw new AppError("not_found", `Agent ${agent.name} has no version ${version}`);
    const spec: AgentSpec = toAgentVersion(row).spec;
    return agentVersionDefinition(meta(agent, id, version, false), spec, this.deps);
  }

  private async load(id: string) {
    const ref = parseAgentAssistantId(id);
    const agent = ref ? await this.repo.getById(ref.agentId) : undefined;
    if (!ref || !agent) throw notFound(id);
    return { agent, agentId: ref.agentId, draft: ref.draft };
  }
}

function meta(
  agent: { name: string; description: string },
  id: string,
  version: number,
  draft: boolean,
) {
  return {
    id,
    name: draft ? `${agent.name} (draft)` : agent.name,
    description: agent.description,
    version,
  };
}

const notFound = (id: string) => new AppError("not_found", `Unknown assistant ${id}`);
