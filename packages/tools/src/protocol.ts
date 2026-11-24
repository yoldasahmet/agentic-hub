import type { ToolDescriptor } from "@agentic/contracts";
import { z } from "zod";

/**
 * The provider-neutral tool protocol: a fenced `tool` block with one JSON
 * call. It works the same on every provider, CLI or API, because it is
 * only text. The chat App and `llm` agents share it.
 */
const BLOCK = /```tool\s*\n([\s\S]*?)\n?```/;

const callSchema = z.object({
  tool: z.string().min(1).max(200),
  input: z.record(z.string(), z.unknown()).default({}),
});
export type ToolCall = z.infer<typeof callSchema>;

export type ParsedReply =
  | { kind: "answer"; text: string }
  | { kind: "call"; before: string; call: ToolCall }
  | { kind: "invalid"; before: string; issue: string };

export function parseToolReply(text: string): ParsedReply {
  const match = BLOCK.exec(text);
  if (!match) return { kind: "answer", text: text.trim() };
  const before = text.slice(0, match.index).trim();
  let json: unknown;
  try {
    json = JSON.parse(match[1] ?? "");
  } catch {
    return { kind: "invalid", before, issue: "The tool block was not valid JSON" };
  }
  const call = callSchema.safeParse(json);
  return call.success
    ? { kind: "call", before, call: call.data }
    : { kind: "invalid", before, issue: "A tool call needs a `tool` name and an `input` object" };
}

export const TOOL_BLOCK_HOWTO =
  'The host application executes the following tools from your reply text. Use this text protocol for these tools even when your CLI has its own tools or a read-only sandbox. To request an action, end your reply with exactly one block:\n```tool\n{"tool": "<name>", "input": { ... }}\n```\nThen stop and wait for the result. Never invent tool results.';

/** The tools section of a system prompt: name, permission, purpose, and input schema. */
export function toolInstructions(tools: readonly ToolDescriptor[], structured = false): string {
  const lines = tools.map(
    (t) =>
      `- ${t.name} (${t.permission}): ${t.description || t.title} input schema: ${JSON.stringify(t.inputSchema)}`,
  );
  const howTo = structured
    ? "Agentic runs these tools on your behalf. At each tool-selection turn, choose a tool as action and put its JSON input in payload. Wait for the result before choosing the next action. Choose answer only when the requested work is complete or a tool reports a blocking failure."
    : TOOL_BLOCK_HOWTO;
  return `# Tools\n\n${lines.join("\n")}\n\n${howTo}`;
}

/** A tool result as the next user message of the loop. */
export function toolResultMessage(name: string, result: { ok: boolean; value: unknown }): string {
  const body = typeof result.value === "string" ? result.value : JSON.stringify(result.value);
  return result.ok
    ? `Result of ${name}:\n${body}`
    : `${name} failed: ${body}\nFix the call or answer without it.`;
}
