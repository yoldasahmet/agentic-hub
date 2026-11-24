import { describe, expect, it } from "vitest";
import { codexMcpArgs } from "./mcp-config";

describe("Codex MCP credentials", () => {
  it("keeps header and stdio credentials out of argv and scopes names per server", () => {
    const { args, env } = codexMcpArgs({
      mcp: {
        allowedTools: ["mcp.remote.read"],
        servers: [
          {
            name: "remote",
            config: {
              transport: "http",
              url: "https://example.invalid/mcp",
              headers: {},
              secretHeaders: { Authorization: "mcp.remote" },
            },
            secrets: { "mcp.remote": "header-fixture" },
          },
          {
            name: "local",
            config: {
              transport: "stdio",
              command: "server",
              args: ["--stdio"],
              env: {},
              secretEnv: { TOKEN: "mcp.local" },
            },
            secrets: { "mcp.local": "stdio-fixture" },
          },
        ],
      },
    });
    expect(args.join(" ")).not.toMatch(/header-fixture|stdio-fixture/);
    expect(args).toContain(
      'mcp_servers.remote.env_http_headers={"Authorization"="AGENTIC_MCP_VALUE_0"}',
    );
    expect(args).toContain('mcp_servers.local.env_vars=["AGENTIC_MCP_VALUE_1"]');
    expect(args).toContain('mcp_servers.remote.enabled_tools=["read"]');
    expect(env).toEqual({
      AGENTIC_MCP_VALUE_0: "header-fixture",
      AGENTIC_MCP_VALUE_1: "stdio-fixture",
    });
  });
});
