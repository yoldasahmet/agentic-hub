import type { LlmRequest, McpServerLaunch, ProviderCapabilities } from "@agentic/contracts";
import type { StreamParser } from "../parsers/stream-parser";

export type CliInvocation = {
  args: string[];
  /** Explicit per-invocation values, kept out of the command line. */
  env?: Record<string, string>;
  /** Sent on stdin and closed; keeps long prompts out of argv. */
  stdin?: string;
  /** Removes temp files (e.g. a schema file) after the run. */
  cleanup?: () => Promise<void>;
};

/**
 * What a run adds beyond the request. MCP servers are launched by the CLI
 * itself (capability `mcp`); `allowedTools` are `mcp.<server>.<tool>`
 * names the approval policy lets run without asking. `skills` is text
 * appended to the system prompt of an interactive session.
 */
export type CliExtras = {
  /** The app executes the selected actions through its own tools and approvals. */
  hostTools?: boolean;
  mcp?: { servers: McpServerLaunch[]; allowedTools: string[] };
  skills?: string;
};

export type AuthProbe = {
  /** Absolute path of the CLI. */
  command: string;
  env: Record<string, string>;
};

export type AuthState = { signedIn: boolean | null; detail?: string };

/**
 * Everything that differs between CLIs, as data plus two small functions.
 * The generic runner (`streamCli`) and `detectCli` do the rest, so adding a
 * CLI is one spec file and one parser file.
 */
export type CliSpec = {
  id: string;
  name: string;
  command: string;
  /** Env prefixes the CLI reads its own auth and config from. */
  passEnv: readonly string[];
  capabilities: ProviderCapabilities;
  versionArgs: readonly string[];
  invoke(req: LlmRequest, extras?: CliExtras): Promise<CliInvocation>;
  /** Extra arguments for an interactive (terminal) session; none when absent. */
  sessionArgs?(extras: CliExtras): Promise<CliInvocation>;
  createParser(): StreamParser;
  checkAuth(probe: AuthProbe): Promise<AuthState>;
};

/** "default" leaves the model choice to the CLI's own config. */
export const usesDefaultModel = (model: string) => model === "default";
