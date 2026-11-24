import {
  AppError,
  type McpServerLaunch,
  type ResolvedSkill,
  type Skill,
  type ToolDescriptor,
  type ToolGuardrails,
} from "@agentic/contracts";
import { checkToolDir } from "./guardrails/allowlist";
import { deadline, limitOutput, maskStrings, withDeadline } from "./guardrails/limits";
import { parseMcpToolName } from "./mcp/descriptors";
import type { McpPool } from "./mcp/pool";
import type { ToolRegistry } from "./registry";
import { resolveSkill } from "./skills/skills";

export type McpServerEntry = { id: string; launch: McpServerLaunch };

/** What the host (Core) provides: workspace data and the vault values to mask. */
export type ToolboxSources = {
  registry: ToolRegistry;
  pool: McpPool;
  scratchDir: string;
  /** Folders the app manages itself (run worktrees); tools may run there like in scratch. */
  managedDirs?: readonly string[];
  /** Enabled servers of the workspace with these names; unknown or disabled ones are left out. */
  mcpServers(workspaceId: string, names: readonly string[]): Promise<McpServerEntry[]>;
  skills(workspaceId: string, slugs: readonly string[]): Promise<Skill[]>;
  guardrails(workspaceId: string): Promise<ToolGuardrails>;
  secretValues(): readonly string[];
};

/** An agent's slots: tool names (`git.*` takes a group), MCP server names, skill slugs. */
export type ToolsetRequest = {
  workspaceId: string;
  tools: readonly string[];
  mcpServers: readonly string[];
  skills: readonly string[];
};

/** The slots of one run, resolved: what the model may call and the skills it reads. */
export type Toolset = {
  tools: ToolDescriptor[];
  skills: ResolvedSkill[];
  /** The attached servers, for providers that run MCP themselves. */
  servers: McpServerLaunch[];
  /** Runs a tool of this set in `cwd` under the workspace guardrails. Approval is the caller's. */
  invoke(
    name: string,
    input: Record<string, unknown>,
    cwd: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  /**
   * Masks vault and MCP secret values in a result. A CLI that runs MCP
   * servers itself returns their output unfiltered, so agent output is
   * masked once more before it is stored.
   */
  mask<T>(value: T): T;
};

export class Toolbox {
  constructor(private readonly sources: ToolboxSources) {}

  /** Every built-in plus the tools of the given servers, for pickers and the tools page. */
  async catalog(workspaceId: string, servers: readonly string[]): Promise<ToolDescriptor[]> {
    const mcp = await this.mcpTools(await this.sources.mcpServers(workspaceId, servers));
    return [...this.sources.registry.list(), ...mcp];
  }

  /**
   * Checks a working dir against the workspace's rules: scratch, a managed
   * folder, or an allowed one. CLI agents run here and may launch MCP
   * servers themselves, so the check can't wait for a tool call.
   */
  async checkDir(workspaceId: string, dir: string): Promise<string> {
    const rules = await this.sources.guardrails(workspaceId);
    return checkToolDir(dir, {
      scratchDir: this.sources.scratchDir,
      allowedDirs: [...rules.allowedDirs, ...(this.sources.managedDirs ?? [])],
    });
  }

  async resolve(req: ToolsetRequest): Promise<Toolset> {
    const named = req.tools.map((n) => parseMcpToolName(n)?.server).filter((s) => s !== undefined);
    const serverNames = [...new Set([...req.mcpServers, ...named])];
    const entries = await this.sources.mcpServers(req.workspaceId, serverNames);
    const missing = serverNames.filter((n) => !entries.some((e) => e.launch.name === n));
    if (missing.length) {
      throw new AppError("not_found", `MCP server not found or disabled: ${missing.join(", ")}`);
    }
    const serverTools = await this.mcpTools(entries);
    const tools = [
      ...this.pick(req.tools, serverTools),
      ...serverTools.filter((t) => req.mcpServers.includes(t.server ?? "")),
    ];
    const unique = [...new Map(tools.map((t) => [t.name, t])).values()];
    const skillRows = await this.sources.skills(req.workspaceId, req.skills);
    const unknownSkills = req.skills.filter((s) => !skillRows.some((row) => row.slug === s));
    if (unknownSkills.length) {
      throw new AppError("not_found", `Skill not found: ${unknownSkills.join(", ")}`);
    }
    return {
      tools: unique,
      skills: await Promise.all(skillRows.map(resolveSkill)),
      servers: entries.map((e) => e.launch),
      invoke: (name, input, cwd, signal) =>
        this.invoke(req.workspaceId, unique, entries, { name, input, cwd, signal }),
      mask: (value) => maskStrings(value, this.secretsOf(entries)),
    };
  }

  private pick(names: readonly string[], serverTools: ToolDescriptor[]): ToolDescriptor[] {
    const all = [...this.sources.registry.list(), ...serverTools];
    return names.flatMap((name) => {
      const found = name.endsWith(".*")
        ? all.filter((t) => t.name.startsWith(name.slice(0, -1)))
        : all.filter((t) => t.name === name);
      if (found.length === 0) throw new AppError("not_found", `Tool ${name} is not registered`);
      return found;
    });
  }

  private async mcpTools(entries: McpServerEntry[]): Promise<ToolDescriptor[]> {
    const lists = await Promise.all(entries.map((e) => this.sources.pool.tools(e.id, e.launch)));
    return lists.flat();
  }

  private async invoke(
    workspaceId: string,
    tools: ToolDescriptor[],
    entries: McpServerEntry[],
    call: { name: string; input: Record<string, unknown>; cwd: string; signal?: AbortSignal },
  ): Promise<unknown> {
    const descriptor = tools.find((t) => t.name === call.name);
    if (!descriptor)
      throw new AppError("tool.not_allowed", `${call.name} is not one of this agent's tools`);
    const rules = await this.sources.guardrails(workspaceId);
    const cwd = await this.checkDir(workspaceId, call.cwd);
    const signal = deadline(call.signal, rules.timeoutMs);
    const secrets = this.sources.secretValues();
    const ctx = {
      workspaceId,
      cwd,
      signal,
      timeoutMs: rules.timeoutMs,
      maxOutputBytes: rules.maxOutputBytes,
      secrets,
    };
    const mcp = parseMcpToolName(call.name);
    const entry = mcp && entries.find((e) => e.launch.name === mcp.server);
    const work =
      entry && mcp
        ? this.sources.pool.call(entry.id, entry.launch, mcp.tool, call.input, signal)
        : this.builtin(call.name).run(call.input, ctx);
    const value = await withDeadline(work, signal);
    return limitOutput(value, rules.maxOutputBytes, this.secretsOf(entries));
  }

  private secretsOf(entries: McpServerEntry[]): string[] {
    return [
      ...this.sources.secretValues(),
      ...entries.flatMap((e) => Object.values(e.launch.secrets)),
    ];
  }

  private builtin(name: string) {
    const def = this.sources.registry.find(name);
    if (!def) throw new AppError("not_found", `Tool ${name} is not registered`);
    return def;
  }
}
