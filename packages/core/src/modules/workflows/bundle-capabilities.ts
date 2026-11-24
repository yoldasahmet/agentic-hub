import type {
  AgentBundle,
  BundledMcpServer,
  BundledSkill,
  WorkflowBundle,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { parseMcpToolName } from "@agentic/tools";
import type { McpService } from "../mcp/service";
import type { SkillService } from "../skills/service";

/** The services that own the skills and MCP servers a bundle's agents name. */
export type BundleTools = { skills: SkillService; mcp: McpService };

/**
 * Creates the bundle's skills and MCP servers the workspace lacks; existing
 * ones are reused as they are, so a person's edits survive. Servers arrive
 * disabled: a stdio server runs a command, so a person reviews it first.
 */
export async function installCapabilities(
  ctx: LocalContext,
  bundle: WorkflowBundle,
  tools: BundleTools,
): Promise<void> {
  const skills = new Set((await tools.skills.list(ctx)).map((s) => s.slug));
  for (const skill of bundle.skills) {
    if (!skills.has(skill.slug)) await tools.skills.create(ctx, { source: "inline", ...skill });
  }
  const servers = new Set((await tools.mcp.list(ctx)).map((s) => s.name));
  for (const server of bundle.mcpServers) {
    if (!servers.has(server.name)) await tools.mcp.create(ctx, { ...server, enabled: false });
  }
}

/**
 * The inline skills and the MCP servers the bundled agents name, so the
 * bundle runs in another workspace. Folder skills stay behind: their text
 * lives on this Mac. Server secrets travel as vault names only.
 */
export async function collectCapabilities(
  ctx: LocalContext,
  agents: AgentBundle[],
  tools: BundleTools,
): Promise<{ skills: BundledSkill[]; mcpServers: BundledMcpServer[] }> {
  const specs = agents.map((a) => a.agent.spec.capabilities);
  const slugs = [...new Set(specs.flatMap((c) => c.skills))];
  const names = new Set(
    specs.flatMap((c) => [
      ...c.mcpServers,
      ...c.tools.flatMap((t) => parseMcpToolName(t)?.server ?? []),
    ]),
  );
  const skills = (await tools.skills.bySlugs(ctx.workspaceId, slugs)).flatMap((s) =>
    s.source === "inline" && s.content ? [{ slug: s.slug, name: s.name, content: s.content }] : [],
  );
  const mcpServers = (await tools.mcp.list(ctx))
    .filter((s) => names.has(s.name))
    .map(({ name, config }) => ({ name, config }));
  return { skills, mcpServers };
}
