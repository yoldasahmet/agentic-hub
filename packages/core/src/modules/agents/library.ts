import { builtinAgents, builtinSkills } from "@agentic/agents";
import {
  type Agent,
  type AgentBundle,
  type AgentExport,
  type AgentSpec,
  AppError,
  agentBundleSchema,
  type BuiltinAgent,
  type BundleFormat,
  type ImportAgentInput,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { stringify as stringifyYaml } from "yaml";
import { parseBundleFile } from "../../lib/bundle-file";
import type { SkillService } from "../skills/service";
import type { AgentService } from "./service";

/**
 * Agents as portable bundles: export and import (JSON or YAML), duplicate,
 * and the built-in library. Everything goes through the agent service, so
 * imports get the same validation and unique slugs as new agents.
 */
export class AgentLibrary {
  constructor(
    private readonly agents: AgentService,
    private readonly skills: SkillService,
  ) {}

  async export(ctx: LocalContext, id: string, format: BundleFormat): Promise<AgentExport> {
    const agent = await this.agents.get(ctx, id);
    const bundle = toBundle(agent);
    const content =
      format === "yaml" ? stringifyYaml(bundle) : `${JSON.stringify(bundle, null, 2)}\n`;
    return { filename: `${agent.slug}.agent.${format}`, content };
  }

  async import(ctx: LocalContext, input: ImportAgentInput): Promise<Agent> {
    return this.install(ctx, parseBundleFile(input, agentBundleSchema, "an agent bundle"));
  }

  async duplicate(ctx: LocalContext, id: string): Promise<Agent> {
    const bundle = toBundle(await this.agents.get(ctx, id));
    return this.install(ctx, {
      ...bundle,
      agent: { ...bundle.agent, name: `${bundle.agent.name} copy` },
    });
  }

  async builtins(ctx: LocalContext): Promise<BuiltinAgent[]> {
    const slugs = new Set((await this.agents.list(ctx, {})).map((a) => a.slug));
    return builtinAgents.map(({ agent }) => ({
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      color: agent.color,
      icon: agent.icon,
      installed: slugs.has(agent.slug),
    }));
  }

  async installBuiltin(ctx: LocalContext, slug: string): Promise<Agent> {
    const bundle = builtinAgents.find((b) => b.agent.slug === slug);
    if (!bundle) throw new AppError("not_found", `No built-in agent ${slug}`);
    const agent = await this.agents.installBuiltin(ctx, bundle.agent);
    await this.ensureSkills(ctx, agent.draft);
    return agent;
  }

  async install(ctx: LocalContext, { agent }: AgentBundle): Promise<Agent> {
    const { spec, ...identity } = agent;
    await this.ensureSkills(ctx, spec);
    return this.agents.create(ctx, { ...identity, spec });
  }

  /**
   * Adds the built-in skills an agent names that the workspace lacks, so it
   * can run; a skill with the same slug that a person made is left as is.
   */
  async ensureSkills(ctx: LocalContext, spec: AgentSpec): Promise<void> {
    const named = spec.capabilities.skills;
    const have = new Set((await this.skills.bySlugs(ctx.workspaceId, named)).map((s) => s.slug));
    for (const skill of builtinSkills) {
      if (named.includes(skill.slug) && !have.has(skill.slug)) {
        try {
          await this.skills.create(ctx, { source: "inline", ...skill });
        } catch (error) {
          // Another installer may have created the same skill after our lookup.
          if (!(error instanceof AppError && error.code === "conflict")) throw error;
        }
      }
    }
  }
}

export function toBundle(agent: Agent): AgentBundle {
  return {
    format: "agentic.agent",
    formatVersion: 1,
    agent: {
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      color: agent.color,
      icon: agent.icon,
      spec: agent.draft,
    },
  };
}
