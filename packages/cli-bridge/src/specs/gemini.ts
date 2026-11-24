import { access } from "node:fs/promises";
import { join } from "node:path";
import { createGeminiParser } from "../parsers/gemini";
import { type CliSpec, usesDefaultModel } from "./cli-spec";
import { renderPrompt } from "./prompt";

const KEY_VARS = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_USE_VERTEXAI"];

export const geminiSpec: CliSpec = {
  id: "gemini",
  name: "Gemini CLI",
  command: "gemini",
  passEnv: ["GEMINI_", "GOOGLE_"],
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
    // `--prompt=` keeps a prompt that starts with "-" from being read as a flag.
    const args = ["--output-format", "stream-json"];
    if (!usesDefaultModel(req.model)) args.push("--model", req.model);
    args.push(`--prompt=${renderPrompt(req, { withSystem: true })}`);
    return { args };
  },
  createParser: createGeminiParser,
  // Gemini has no status command: an API key in the env or cached OAuth creds count as signed in.
  async checkAuth({ env }) {
    if (KEY_VARS.some((key) => env[key])) return { signedIn: true, detail: "API key" };
    try {
      await access(join(env.HOME ?? "", ".gemini", "oauth_creds.json"));
      return { signedIn: true, detail: "Google sign-in" };
    } catch {
      return { signedIn: false, detail: "Run `gemini` once to sign in" };
    }
  },
};
