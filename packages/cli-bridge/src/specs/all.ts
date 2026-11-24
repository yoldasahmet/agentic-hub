import { claudeCodeSpec } from "./claude-code";
import { codexSpec } from "./codex";
import { geminiSpec } from "./gemini";
import { openCodeSpec } from "./opencode";

/** The CLIs the app mirrors, in display order. */
export const cliSpecs = [claudeCodeSpec, codexSpec, geminiSpec, openCodeSpec] as const;
