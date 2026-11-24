import type { CliExtras } from "@agentic/cli-bridge";
import { renderSkills, type Toolbox } from "@agentic/tools";
import type { ExtrasOf } from "../terminals/service";

/**
 * A terminal session's MCP servers and skills. No tool is pre-allowed: an
 * interactive CLI asks the person in the terminal before each call.
 */
export function terminalExtras(toolbox: Toolbox): ExtrasOf {
  return async (ctx, { mcpServers, skills }) => {
    if (!mcpServers.length && !skills.length) return undefined;
    const toolset = await toolbox.resolve({
      workspaceId: ctx.workspaceId,
      tools: [],
      mcpServers,
      skills,
    });
    const extras: CliExtras = { skills: renderSkills(toolset.skills) || undefined };
    if (toolset.servers.length) extras.mcp = { servers: toolset.servers, allowedTools: [] };
    return extras;
  };
}
