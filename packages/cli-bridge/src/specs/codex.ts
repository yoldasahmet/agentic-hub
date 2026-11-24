import { createCodexParser } from "../parsers/codex";
import { runCommand } from "../process/run-command";
import { writeTempFile } from "../process/temp-file";
import { type CliSpec, usesDefaultModel } from "./cli-spec";
import { codexMcpArgs } from "./mcp-config";
import { renderPrompt } from "./prompt";

// Host-tool rounds are decisions for Agentic. Codex itself has a read-only workspace.
const hostToolInstructions = [
  "You are selecting the next action in an Agentic workflow. Agentic owns the working directory and has already obtained approval for the tools it lists.",
  "Return one decision in the requested response schema. For file changes select fs.write with path and content. Agentic executes it and sends its actual result on the next turn.",
  "Use the listed Agentic actions for repository reads, writes, commits, tests and pull requests. Do not use Codex's native shell or patch tool. The Codex sandbox and Agentic worktree are separate.",
  "Only choose answer after the tool results establish completion or an actual host tool reports a blocking failure. Report only URLs and commit IDs returned by the tools.",
].join(" ");

export const codexSpec: CliSpec = {
  id: "codex",
  name: "Codex",
  command: "codex",
  passEnv: ["OPENAI_", "CODEX_"],
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
    // The sandbox stays read-only: writes go through our tools and their approvals (P9.1).
    const args = ["exec", "--json", "--skip-git-repo-check", "--sandbox", "read-only"];
    if (extras?.hostTools) {
      args.push(
        "--ignore-user-config",
        "--disable",
        "apps",
        "--disable",
        "plugins",
        "--disable",
        "shell_tool",
        "-c",
        `developer_instructions=${JSON.stringify(hostToolInstructions)}`,
      );
    }
    const mcp = codexMcpArgs(extras);
    args.push(...mcp.args);
    if (!usesDefaultModel(req.model)) args.push("--model", req.model);
    if (req.reasoning) args.push("-c", `model_reasoning_effort="${req.reasoning}"`);
    let cleanup: (() => Promise<void>) | undefined;
    if (req.outputSchema) {
      const file = await writeTempFile("output-schema.json", JSON.stringify(req.outputSchema));
      args.push("--output-schema", file.path);
      cleanup = file.cleanup;
    }
    args.push("-");
    return { args, env: mcp.env, stdin: renderPrompt(req, { withSystem: true }), cleanup };
  },
  async sessionArgs(extras) {
    return codexMcpArgs(extras);
  },
  createParser: createCodexParser,
  async checkAuth({ command, env }) {
    const out = await runCommand(command, ["login", "status"], { env });
    const text = `${out.stdout}${out.stderr}`.trim().split("\n").at(-1);
    if (out.code === 0) return { signedIn: true, detail: text };
    return { signedIn: false, detail: "Run `codex login` to sign in" };
  },
};
