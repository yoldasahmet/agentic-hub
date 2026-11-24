import { z } from "zod";
import { createClaudeCodeParser } from "../parsers/claude-code";
import { parseJsonLine } from "../parsers/stream-parser";
import { runCommand } from "../process/run-command";
import { type CliSpec, usesDefaultModel } from "./cli-spec";
import { claudeMcpArgs } from "./mcp-config";
import { renderPrompt } from "./prompt";

const authStatus = z.looseObject({ loggedIn: z.boolean(), authMethod: z.string().optional() });

export const claudeCodeSpec: CliSpec = {
  id: "claude-code",
  name: "Claude Code",
  command: "claude",
  passEnv: ["ANTHROPIC_", "CLAUDE_", "AWS_", "CLOUD_ML_", "GOOGLE_APPLICATION_CREDENTIALS"],
  capabilities: {
    streaming: true,
    tools: false,
    structuredOutput: "native",
    reasoning: true,
    images: false,
    mcp: true,
  },
  versionArgs: ["--version"],
  async invoke(req, extras) {
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--no-session-persistence",
    ];
    if (!usesDefaultModel(req.model)) args.push("--model", req.model);
    if (req.system) args.push("--system-prompt", req.system);
    if (req.reasoning) args.push("--effort", req.reasoning);
    if (req.outputSchema) args.push("--json-schema", JSON.stringify(req.outputSchema));
    const mcp = await claudeMcpArgs(extras);
    args.push(...mcp.args);
    return { args, stdin: renderPrompt(req, { withSystem: false }), cleanup: mcp.cleanup };
  },
  async sessionArgs(extras) {
    const mcp = await claudeMcpArgs(extras);
    const args = [...mcp.args];
    if (extras.skills) args.push("--append-system-prompt", extras.skills);
    return { args, cleanup: mcp.cleanup };
  },
  createParser: createClaudeCodeParser,
  async checkAuth({ command, env }) {
    const out = await runCommand(command, ["auth", "status"], { env });
    const parsed = authStatus.safeParse(parseJsonLine(out.stdout.replace(/\s+/g, " ")));
    if (!parsed.success) return { signedIn: null, detail: "Run `claude` once to sign in" };
    return {
      signedIn: parsed.data.loggedIn,
      detail: parsed.data.loggedIn ? parsed.data.authMethod : "Run `claude` to sign in",
    };
  },
};
