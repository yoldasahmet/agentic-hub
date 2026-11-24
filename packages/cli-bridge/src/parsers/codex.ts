import type { LlmEvent } from "@agentic/contracts";
import { z } from "zod";
import { count, lineParser, parseJsonLine, type StreamParser } from "./stream-parser";

const item = z.discriminatedUnion("type", [
  z.looseObject({ type: z.literal("agent_message"), id: z.string(), text: z.string() }),
  z.looseObject({ type: z.literal("reasoning"), id: z.string(), text: z.string() }),
  z.looseObject({
    type: z.literal("command_execution"),
    id: z.string(),
    command: z.string(),
    aggregated_output: z.string().catch(""),
    exit_code: z.number().nullish(),
    status: z.string().optional(),
  }),
  z.looseObject({
    type: z.literal("file_change"),
    id: z.string(),
    changes: z.array(z.unknown()).catch([]),
    status: z.string().optional(),
  }),
  z.looseObject({
    type: z.literal("mcp_tool_call"),
    id: z.string(),
    server: z.string(),
    tool: z.string(),
    arguments: z.unknown().optional(),
    result: z.unknown().optional(),
    error: z.looseObject({ message: z.string() }).nullish(),
    status: z.string().optional(),
  }),
  z.looseObject({ type: z.literal("web_search"), id: z.string(), query: z.string() }),
  z.looseObject({ type: z.literal("error"), id: z.string(), message: z.string() }),
]);
type Item = z.infer<typeof item>;

const line = z.discriminatedUnion("type", [
  z.looseObject({ type: z.literal("item.started"), item: z.unknown() }),
  z.looseObject({ type: z.literal("item.completed"), item: z.unknown() }),
  z.looseObject({
    type: z.literal("turn.completed"),
    usage: z.looseObject({ input_tokens: count, cached_input_tokens: count, output_tokens: count }),
  }),
  z.looseObject({ type: z.literal("turn.failed"), error: z.looseObject({ message: z.string() }) }),
  z.looseObject({ type: z.literal("error"), message: z.string() }),
]);

function toolCall(it: Item): LlmEvent | undefined {
  switch (it.type) {
    case "command_execution":
      return { type: "tool_call", id: it.id, name: "shell", input: { command: it.command } };
    case "file_change":
      return { type: "tool_call", id: it.id, name: "apply_patch", input: { changes: it.changes } };
    case "mcp_tool_call":
      return { type: "tool_call", id: it.id, name: `${it.server}.${it.tool}`, input: it.arguments };
    case "web_search":
      return { type: "tool_call", id: it.id, name: "web_search", input: { query: it.query } };
    default:
      return undefined;
  }
}

function completed(it: Item): LlmEvent[] {
  switch (it.type) {
    case "agent_message":
      return [{ type: "text", delta: it.text }];
    case "reasoning":
      return [{ type: "thinking", delta: it.text }];
    case "command_execution":
      return [
        {
          type: "tool_result",
          id: it.id,
          output: it.aggregated_output,
          isError: (it.exit_code ?? 0) !== 0,
        },
      ];
    case "file_change":
      return [
        {
          type: "tool_result",
          id: it.id,
          output: it.status ?? "completed",
          isError: it.status === "failed",
        },
      ];
    case "mcp_tool_call":
      return [
        {
          type: "tool_result",
          id: it.id,
          output: it.error?.message ?? it.result,
          isError: !!it.error,
        },
      ];
    case "web_search":
      return [{ type: "tool_result", id: it.id, output: null, isError: false }];
    case "error":
      return [{ type: "error", message: it.message }];
  }
}

/**
 * `codex exec --json`. Items arrive whole (no text deltas): a message is
 * one `text` event. Tool items start and complete; a tool call is emitted
 * once, on start, or on completion if the start was never seen.
 * Codex counts cached tokens inside `input_tokens`; ours excludes them.
 */
export function createCodexParser(): StreamParser {
  const started = new Set<string>();
  return lineParser(line, (ev): LlmEvent[] => {
    if (ev.type === "item.started" || ev.type === "item.completed") {
      const parsed = item.safeParse(ev.item);
      if (!parsed.success) return [];
      const it = parsed.data;
      const call = toolCall(it);
      if (ev.type === "item.started") {
        if (!call) return [];
        started.add(it.id);
        return [call];
      }
      const head = call && !started.has(it.id) ? [call] : [];
      return [...head, ...completed(it)];
    }
    if (ev.type === "turn.completed") {
      const { input_tokens, cached_input_tokens, output_tokens } = ev.usage;
      return [
        {
          type: "usage",
          usage: {
            inputTokens: Math.max(0, input_tokens - cached_input_tokens),
            cacheReadTokens: cached_input_tokens,
            outputTokens: output_tokens,
          },
        },
        { type: "done", stopReason: "end_turn" },
      ];
    }
    const message = ev.type === "turn.failed" ? ev.error.message : ev.message;
    const response = z
      .object({ error: z.object({ code: z.string() }) })
      .safeParse(parseJsonLine(message));
    if (response.success && response.data.error.code === "invalid_json_schema") {
      return [{ type: "error", code: "llm.schema_rejected", message }];
    }
    return [{ type: "error", message }];
  });
}
