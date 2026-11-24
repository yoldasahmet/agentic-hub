import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { createOpenCodeParser } from "../parsers/opencode";
import { type CliSpec, usesDefaultModel } from "./cli-spec";
import { renderPrompt } from "./prompt";

const authFile = z.record(z.string(), z.unknown());

export const openCodeSpec: CliSpec = {
  id: "opencode",
  name: "OpenCode",
  command: "opencode",
  passEnv: ["OPENCODE_"],
  capabilities: {
    streaming: true,
    tools: false,
    structuredOutput: "extract",
    reasoning: false,
    images: false,
    mcp: false,
  },
  versionArgs: ["--version"],
  async invoke(req) {
    // OpenCode models are "provider/model", e.g. "anthropic/claude-sonnet-4-5".
    const args = ["run", "--format", "json"];
    if (!usesDefaultModel(req.model)) args.push("--model", req.model);
    args.push("--", renderPrompt(req, { withSystem: true }));
    return { args };
  },
  createParser: createOpenCodeParser,
  // `opencode auth login` stores provider credentials in its data dir.
  async checkAuth({ env }) {
    const dataHome = env.XDG_DATA_HOME ?? join(env.HOME ?? "", ".local", "share");
    try {
      const raw = await readFile(join(dataHome, "opencode", "auth.json"), "utf8");
      const providers = Object.keys(authFile.parse(JSON.parse(raw)));
      if (providers.length > 0) return { signedIn: true, detail: providers.join(", ") };
    } catch {
      // No credentials file yet.
    }
    return { signedIn: false, detail: "Run `opencode auth login` to add a provider" };
  },
};
