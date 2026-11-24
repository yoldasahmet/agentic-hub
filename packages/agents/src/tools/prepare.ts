import type { AgentSpec, ToolDescriptor } from "@agentic/contracts";
import type { CliExtras, LlmProvider } from "@agentic/llm";
import { renderSkills, type Toolset, toolInstructions } from "@agentic/tools";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { AgentRuntimeDeps } from "../deps";
import { workspaceOf } from "../workspace";
import { grantTools } from "./approval";

export type PreparedTools = { toolset: Toolset; granted: ToolDescriptor[] };

/**
 * Resolves an `llm` agent's slots and asks for any approvals, before the
 * first model call. Undefined when the agent has no tools, servers, or skills.
 */
export async function prepareTools(
  spec: AgentSpec,
  cwd: string,
  deps: AgentRuntimeDeps,
  config: LangGraphRunnableConfig,
): Promise<PreparedTools | undefined> {
  const { tools, mcpServers, skills, approval } = spec.capabilities;
  if (!tools.length && !mcpServers.length && !skills.length) return undefined;
  const toolset = await deps.tools.resolve({
    workspaceId: workspaceOf(config),
    tools,
    mcpServers,
    skills,
  });
  return { toolset, granted: grantTools(toolset.tools, approval, cwd) };
}

export type ProviderTools = {
  /** Tools the model calls through the `tool` block. */
  fenced: ToolDescriptor[];
  /** MCP servers for a CLI that runs them itself, limited to the granted tools. */
  extras?: CliExtras;
  /** Skills and tool instructions to append to the system prompt. */
  system: string;
};

/**
 * Splits the granted tools per provider: a CLI with its own MCP client
 * runs the servers' tools natively; everything else goes through the
 * provider-neutral tool block.
 */
export function toolsFor(
  prepared: PreparedTools | undefined,
  provider: LlmProvider,
): ProviderTools {
  if (!prepared) return { fenced: [], system: "" };
  const { toolset, granted } = prepared;
  const native = provider.capabilities.mcp && toolset.servers.length > 0;
  const fenced = native ? granted.filter((t) => t.source !== "mcp") : granted;
  const allowedTools = granted.filter((t) => t.source === "mcp").map((t) => t.name);
  const sections = [
    renderSkills(toolset.skills),
    fenced.length
      ? toolInstructions(fenced, provider.capabilities.structuredOutput === "native")
      : "",
  ];
  return {
    fenced,
    extras: {
      hostTools: fenced.length > 0,
      mcp: native ? { servers: toolset.servers, allowedTools } : undefined,
    },
    system: sections.filter(Boolean).join("\n\n"),
  };
}
