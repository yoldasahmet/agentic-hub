import type { McpServerLaunch } from "@agentic/contracts";
import { writeTempFile } from "../process/temp-file";
import type { CliExtras, CliInvocation } from "./cli-spec";

/** Env and headers with their vault secrets filled in, only for the CLI that launches the server. */
function resolved(server: McpServerLaunch) {
  const { config, secrets } = server;
  const fill = (refs: Record<string, string>) =>
    Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, secrets[ref] ?? ""]));
  return config.transport === "stdio"
    ? { ...config, env: { ...config.env, ...fill(config.secretEnv) } }
    : { ...config, headers: { ...config.headers, ...fill(config.secretHeaders) } };
}

/** Our `mcp.<server>.<tool>` → Claude Code's `mcp__<server>__<tool>`. */
const claudeToolName = (name: string) => {
  const [, server, ...tool] = name.split(".");
  return `mcp__${server}__${tool.join(".")}`;
};

/**
 * Claude Code takes servers from a JSON file (0600, removed after the run;
 * it holds secrets). `--strict-mcp-config` ignores the user's own servers,
 * and only the allowed tools run, since `-p` cannot ask for approval.
 */
export async function claudeMcpArgs(extras: CliExtras | undefined): Promise<CliInvocation> {
  const mcp = extras?.mcp;
  if (!mcp?.servers.length) return { args: [] };
  const mcpServers = Object.fromEntries(
    mcp.servers.map((server) => {
      const config = resolved(server);
      return [
        server.name,
        config.transport === "stdio"
          ? { type: "stdio", command: config.command, args: config.args, env: config.env }
          : { type: "http", url: config.url, headers: config.headers },
      ];
    }),
  );
  const file = await writeTempFile("mcp.json", JSON.stringify({ mcpServers }));
  const args = ["--mcp-config", file.path, "--strict-mcp-config"];
  if (mcp.allowedTools.length) {
    args.push("--allowedTools", mcp.allowedTools.map(claudeToolName).join(","));
  }
  return { args, cleanup: file.cleanup };
}

/** Codex resolves per-server env and HTTP headers by name from its child environment. */
export function codexMcpArgs(extras: CliExtras | undefined): CliInvocation {
  const args: string[] = [];
  const env: Record<string, string> = {};
  let next = 0;
  const bind = (value: string) => {
    const name = `AGENTIC_MCP_VALUE_${next++}`;
    env[name] = value;
    return name;
  };
  for (const server of extras?.mcp?.servers ?? []) {
    const config = resolved(server);
    const key = `mcp_servers.${server.name}`;
    const set = (field: string, value: string) => args.push("-c", `${key}.${field}=${value}`);
    if (config.transport === "stdio") {
      const entries = Object.entries(config.env);
      if (entries.length === 0) {
        set("command", JSON.stringify(config.command));
        set("args", JSON.stringify(config.args));
      } else {
        // Each server can require the same variable name with a different value.
        // Only validated env names enter the script. Values stay in the environment.
        const vars = entries.map(([name, value]) => ({ name, source: bind(value) }));
        const exports = vars.map(({ name, source }) => `export ${name}="$${source}"`);
        const script = [...exports, 'exec "$@"'].join("\n");
        set("command", '"/bin/sh"');
        set("args", JSON.stringify(["-c", script, "mcp", config.command, ...config.args]));
        set("env_vars", JSON.stringify(vars.map((v) => v.source)));
      }
    } else {
      set("url", JSON.stringify(config.url));
      const headers = Object.entries(config.headers).map(([name, value]) => [name, bind(value)]);
      set("env_http_headers", toml(Object.fromEntries(headers)));
    }
    const prefix = `mcp.${server.name}.`;
    const allowed = extras?.mcp?.allowedTools.filter((t) => t.startsWith(prefix)) ?? [];
    set("enabled_tools", JSON.stringify(allowed.map((t) => t.slice(prefix.length))));
  }
  return { args, env };
}

function toml(record: Record<string, string>): string {
  const pairs = Object.entries(record).map(([k, v]) => `${JSON.stringify(k)}=${JSON.stringify(v)}`);
  return `{${pairs.join(",")}}`;
}
