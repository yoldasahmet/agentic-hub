import type { Database } from "@agentic/db";
import { builtinTools, McpPool, Toolbox, ToolRegistry } from "@agentic/tools";
import type { SecretStore } from "../../runtime/secret-store";
import { McpServerRepository } from "../mcp/repository";
import { McpService } from "../mcp/service";
import { SkillRepository } from "../skills/repository";
import { SkillService } from "../skills/service";
import { GuardrailsRepository } from "./guardrails-repository";
import { ToolService } from "./service";

export type ToolModuleDeps = {
  db: Database;
  scratchDir: string;
  version: string;
  secrets: SecretStore;
  /** Folders the app manages (run worktrees), usable by tools without an allowlist entry. */
  managedDirs?: string[];
};

/**
 * Wires tools, MCP servers, and skills, and the `Toolbox` agent runs use
 * to resolve their slots. Integrations register their tools on `registry`.
 */
export function createToolModule({
  db,
  scratchDir,
  version,
  secrets,
  managedDirs = [],
}: ToolModuleDeps) {
  const registry = new ToolRegistry().register(...builtinTools());
  const pool = new McpPool(version);
  const mcp = new McpService(new McpServerRepository(db), pool, (name) => secrets.get(name));
  const skills = new SkillService(new SkillRepository(db));
  const guardrails = new GuardrailsRepository(db);
  const toolbox = new Toolbox({
    registry,
    pool,
    scratchDir,
    managedDirs,
    mcpServers: (workspaceId, names) => mcp.entries(workspaceId, names),
    skills: (workspaceId, slugs) => skills.bySlugs(workspaceId, slugs),
    guardrails: (workspaceId) => guardrails.get(workspaceId),
    secretValues: () => secrets.allValues(),
  });
  return {
    registry,
    toolbox,
    mcp,
    skills,
    guardrails,
    service: new ToolService(registry, mcp, guardrails),
    close: () => pool.closeAll(),
  };
}

export type ToolModule = ReturnType<typeof createToolModule>;
