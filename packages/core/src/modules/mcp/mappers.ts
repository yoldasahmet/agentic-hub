import {
  AppError,
  type McpServer,
  type McpServerConfig,
  type McpServerLaunch,
  mcpServerConfigSchema,
} from "@agentic/contracts";
import type { McpServerRow } from "./repository";

export function toMcpServer(row: McpServerRow): McpServer {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    config: mcpServerConfigSchema.parse(row.config),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The vault names a config points at. */
export function secretRefs(config: McpServerConfig): string[] {
  return Object.values(config.transport === "stdio" ? config.secretEnv : config.secretHeaders);
}

/**
 * A server ready to connect, its secrets read from Core's in-memory copy
 * of the vault. A missing secret fails here, by name, instead of sending
 * an empty token to the server.
 */
export function toLaunch(
  server: McpServer,
  secret: (name: string) => string | undefined,
): McpServerLaunch {
  const secrets: Record<string, string> = {};
  for (const ref of secretRefs(server.config)) {
    const value = secret(ref);
    if (!value) {
      throw new AppError(
        "mcp.secret_missing",
        `MCP server ${server.name} needs the secret "${ref}"; add it in Settings → Secrets`,
      );
    }
    secrets[ref] = value;
  }
  return { name: server.name, config: server.config, secrets };
}
