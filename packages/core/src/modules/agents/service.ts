import {
  type Agent,
  type AgentBundle,
  type AgentListQuery,
  type AgentSpec,
  type AgentTestInput,
  type AgentVersion,
  AppError,
  agentAssistantId,
  agentDraftAssistantId,
  agentTestInputsSchema,
  type CreateAgentInput,
  colorForId,
  createAgentInputSchema,
  defaultAgentSpec,
  newId,
  type Run,
  type RunAgentInput,
  runAgentInputSchema,
  type UpdateAgentInput,
  updateAgentInputSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import type { GraphRuntime } from "@agentic/graph";
import { checkJsonSchema } from "@agentic/llm";
import { z } from "zod";
import { slugify, uniqueSlug } from "../../lib/slug";
import { toAgent, toAgentVersion } from "./mappers";
import type { AgentRepository } from "./repository";
import type { TestInputRepository } from "./test-inputs";

/** Agent CRUD, drafts and versions (D10), and runs (the playground). */
export class AgentService {
  constructor(
    private readonly repo: AgentRepository,
    private readonly savedInputs: TestInputRepository,
    private readonly graph: GraphRuntime,
  ) {}

  async list(ctx: LocalContext, query: AgentListQuery): Promise<Agent[]> {
    return (await this.repo.list(ctx, query.archived === "1")).map(toAgent);
  }

  async get(ctx: LocalContext, id: string): Promise<Agent> {
    return toAgent(await this.repo.get(ctx, id));
  }

  async create(ctx: LocalContext, raw: CreateAgentInput): Promise<Agent> {
    const input = createAgentInputSchema.parse(raw);
    const base = input.slug ?? slugify(input.name);
    const slug = uniqueSlug(base, await this.repo.slugsLike(ctx, base));
    const row = await this.repo.insert(ctx, {
      name: input.name,
      slug,
      description: input.description,
      color: input.color ?? colorForId(newId()),
      icon: input.icon ?? "bot",
      draft: input.spec ?? defaultAgentSpec(),
    });
    return toAgent(row);
  }

  async installBuiltin(ctx: LocalContext, { spec, ...identity }: AgentBundle["agent"]) {
    return toAgent(await this.repo.installBuiltin(ctx, { ...identity, draft: spec }));
  }

  /** Autosave: identity and draft edits at the caller's revision. */
  async update(ctx: LocalContext, id: string, raw: UpdateAgentInput): Promise<Agent> {
    const { revision, ...patch } = updateAgentInputSchema.parse(raw);
    if (patch.slug) {
      const current = await this.repo.get(ctx, id);
      const taken = await this.repo.slugsLike(ctx, patch.slug);
      if (patch.slug !== current.slug && taken.includes(patch.slug)) {
        throw new AppError("conflict", `Another agent already uses the slug ${patch.slug}`);
      }
    }
    return toAgent(await this.repo.update(ctx, id, revision, patch));
  }

  async setArchived(ctx: LocalContext, id: string, archived: boolean): Promise<Agent> {
    return toAgent(await this.repo.setArchived(ctx, id, archived));
  }

  async publish(ctx: LocalContext, id: string, revision: number): Promise<AgentVersion> {
    return toAgentVersion(await this.repo.publish(ctx, id, revision));
  }

  async versions(ctx: LocalContext, id: string): Promise<AgentVersion[]> {
    await this.repo.get(ctx, id);
    return (await this.repo.listVersions(ctx, id)).map(toAgentVersion);
  }

  /**
   * Starts a run of the draft or a published version. Inputs are checked
   * here so the form shows the problem before a thread exists.
   */
  async run(ctx: LocalContext, id: string, raw: RunAgentInput): Promise<Run> {
    const input = runAgentInputSchema.parse(raw);
    const agent = toAgent(await this.repo.get(ctx, id));
    const spec =
      input.version === "draft" ? agent.draft : await this.versionSpec(id, input.version);
    const checked = checkJsonSchema(spec.inputSchema, input.input);
    if (!checked.ok) {
      throw new AppError("validation_failed", "Some inputs are missing or invalid", {
        issues: checked.issues,
      });
    }
    const state: Record<string, unknown> = { input: input.input };
    if (input.model) state.model = input.model;
    if (input.version === "draft") state.spec = spec;
    return this.graph.runs.create(ctx, {
      assistantId: input.version === "draft" ? agentDraftAssistantId(id) : agentAssistantId(id),
      assistantVersion: input.version === "draft" ? undefined : input.version,
      input: jsonRecord.parse(JSON.parse(JSON.stringify(state))),
    });
  }

  async testInputs(ctx: LocalContext, id: string): Promise<AgentTestInput[]> {
    await this.repo.get(ctx, id);
    return this.savedInputs.get(ctx, id);
  }

  async setTestInputs(
    ctx: LocalContext,
    id: string,
    raw: AgentTestInput[],
  ): Promise<AgentTestInput[]> {
    const inputs = agentTestInputsSchema.parse(raw);
    await this.repo.get(ctx, id);
    await this.savedInputs.set(ctx, id, inputs);
    return inputs;
  }

  /** Callers have already loaded the agent in `ctx`, which scopes the unscoped version read. */
  private async versionSpec(id: string, version: number): Promise<AgentSpec> {
    const found = await this.repo.getVersion(id, version);
    if (!found) throw new AppError("not_found", `This agent has no version ${version}`);
    return toAgentVersion(found).spec;
  }
}

/** Drops `undefined` fields (JSON round trip) and proves the result is JSON. */
const jsonRecord = z.record(z.string(), z.json());
