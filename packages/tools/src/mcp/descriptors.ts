import type { ToolDescriptor, ToolPermission } from "@agentic/contracts";

const TOOL_NAME = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

type McpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean };
};

export const mcpToolName = (server: string, tool: string) => `mcp.${server}.${tool}`;

/** `mcp.<server>.<tool>` → the server and its own tool name. */
export function parseMcpToolName(name: string): { server: string; tool: string } | undefined {
  const match = /^mcp\.([a-z0-9-]+)\.(.+)$/.exec(name);
  return match?.[1] && match[2] ? { server: match[1], tool: match[2] } : undefined;
}

/**
 * The server's annotations pick the permission: read-only hints are
 * `read`, destructive hints are `dangerous`, and anything unmarked is
 * `write`, since a tool that says nothing may change something.
 */
export function describeMcpTool(server: string, tool: McpTool): ToolDescriptor | undefined {
  if (!TOOL_NAME.test(tool.name) || tool.name.length > 128) return undefined;
  return {
    name: mcpToolName(server, tool.name),
    title: tool.title ?? tool.annotations?.title ?? tool.name,
    description: tool.description ?? "",
    permission: permissionOf(tool.annotations),
    inputSchema: tool.inputSchema,
    source: "mcp",
    server,
  };
}

function permissionOf(annotations: McpTool["annotations"]): ToolPermission {
  if (annotations?.readOnlyHint) return "read";
  if (annotations?.destructiveHint) return "dangerous";
  return "write";
}
