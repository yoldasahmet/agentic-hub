import { buildChildEnv, resolveCommand, searchPath } from "@agentic/cli-bridge";
import { AppError, type McpServerLaunch, type ToolDescriptor } from "@agentic/contracts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { describeMcpTool } from "./descriptors";
import { readCallResult } from "./result";

export type McpConnection = {
  listTools(): Promise<ToolDescriptor[]>;
  /** `tool` is the server's own name for it, not `mcp.<server>.<tool>`. */
  call(tool: string, input: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
};

const CONNECT_TIMEOUT_MS = 30_000;

/**
 * Opens an MCP client over stdio or streamable HTTP. A stdio server gets
 * the same filtered env and PATH lookup as CLIs, plus its own env and
 * secrets; nothing else from the app's environment.
 */
export async function connectMcp(launch: McpServerLaunch, version: string): Promise<McpConnection> {
  const transport = await openTransport(launch);
  const client = new Client({ name: "agentic", version });
  try {
    await client.connect(transport, { timeout: CONNECT_TIMEOUT_MS });
  } catch (err) {
    await transport.close().catch(() => undefined);
    throw new AppError("mcp.connect_failed", `Could not connect to MCP server ${launch.name}`, {
      cause: err instanceof Error ? err.message : String(err),
    });
  }
  return {
    async listTools() {
      const tools: ToolDescriptor[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined);
        for (const tool of page.tools) {
          const descriptor = describeMcpTool(launch.name, tool);
          if (descriptor) tools.push(descriptor);
        }
        cursor = page.nextCursor;
      } while (cursor);
      return tools;
    },
    async call(tool, input, signal) {
      const result = await client.callTool({ name: tool, arguments: input }, undefined, {
        signal,
        timeout: 600_000,
      });
      return readCallResult(tool, result);
    },
    close: () => client.close(),
  };
}

async function openTransport(launch: McpServerLaunch): Promise<Transport> {
  const { config, secrets } = launch;
  const fill = (refs: Record<string, string>) =>
    Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, secrets[ref] ?? ""]));
  if (config.transport === "http") {
    const headers = { ...config.headers, ...fill(config.secretHeaders) };
    return new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers } });
  }
  const path = await searchPath();
  const command = await resolveCommand(config.command, path);
  if (!command) {
    throw new AppError("mcp.connect_failed", `\`${config.command}\` was not found on PATH`);
  }
  const env = buildChildEnv(process.env, {
    path,
    extra: { ...config.env, ...fill(config.secretEnv) },
  });
  return new StdioClientTransport({ command, args: config.args, env, stderr: "ignore" });
}
