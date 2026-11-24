import type { LlmEvent } from "@agentic/contracts";
import { z } from "zod";
import { count, lineParser, type StreamParser } from "./stream-parser";

const block = z.discriminatedUnion("type", [
  z.looseObject({ type: z.literal("text"), text: z.string() }),
  z.looseObject({ type: z.literal("thinking"), thinking: z.string().catch("") }),
  z.looseObject({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.looseObject({
    type: z.literal("tool_result"),
    tool_use_id: z.string(),
    content: z.unknown(),
    is_error: z.boolean().catch(false),
  }),
]);
type Block = z.infer<typeof block>;
const STRUCTURED_TOOL = "StructuredOutput";
const content = z.array(z.unknown()).catch([]);

/** Keeps the content blocks we understand (images, documents, … are skipped). */
const blocks = (items: unknown[]): Block[] =>
  items.flatMap((item) => {
    const parsed = block.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });

const line = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("stream_event"),
    parent_tool_use_id: z.string().nullish(),
    api_message_id: z.string().optional(),
    event: z.looseObject({
      type: z.string(),
      delta: z
        .looseObject({ type: z.string(), text: z.string(), thinking: z.string() })
        .partial()
        .optional(),
    }),
  }),
  z.looseObject({
    type: z.literal("assistant"),
    parent_tool_use_id: z.string().nullish(),
    message: z.looseObject({ id: z.string().optional(), content }),
  }),
  z.looseObject({
    type: z.literal("user"),
    parent_tool_use_id: z.string().nullish(),
    message: z.looseObject({ content }),
  }),
  z.looseObject({
    type: z.literal("result"),
    is_error: z.boolean().catch(false),
    result: z.string().optional(),
    stop_reason: z.string().nullish(),
    total_cost_usd: z.number().optional(),
    structured_output: z.unknown().optional(),
    usage: z
      .looseObject({
        input_tokens: count,
        output_tokens: count,
        cache_read_input_tokens: count,
        cache_creation_input_tokens: count,
      })
      .optional(),
  }),
]);

/**
 * `claude -p --output-format stream-json --verbose --include-partial-messages`.
 * Text and thinking come from the partial deltas; the complete `assistant`
 * message then repeats them, so its text is used only when no deltas came
 * (an older CLI or partials off). Tool calls come from complete messages.
 * Events from subagents (`parent_tool_use_id`) stay inside their tool call.
 */
export function createClaudeCodeParser(): StreamParser {
  const streamed = new Set<string>();
  // `--json-schema` answers through an internal tool; its value arrives on `result`.
  const internal = new Set<string>();
  return lineParser(line, (ev): LlmEvent[] => {
    if ("parent_tool_use_id" in ev && ev.parent_tool_use_id) return [];
    switch (ev.type) {
      case "stream_event": {
        const delta = ev.event.delta;
        if (ev.event.type !== "content_block_delta" || !delta) return [];
        if (ev.api_message_id) streamed.add(ev.api_message_id);
        if (delta.type === "text_delta" && delta.text) return [{ type: "text", delta: delta.text }];
        if (delta.type === "thinking_delta" && delta.thinking) {
          return [{ type: "thinking", delta: delta.thinking }];
        }
        return [];
      }
      case "assistant": {
        const seen = ev.message.id !== undefined && streamed.has(ev.message.id);
        return blocks(ev.message.content).flatMap((b): LlmEvent[] => {
          if (b.type === "tool_use") {
            if (b.name !== STRUCTURED_TOOL)
              return [{ type: "tool_call", id: b.id, name: b.name, input: b.input }];
            internal.add(b.id);
            return [];
          }
          if (seen) return [];
          if (b.type === "text") return [{ type: "text", delta: b.text }];
          if (b.type === "thinking" && b.thinking) return [{ type: "thinking", delta: b.thinking }];
          return [];
        });
      }
      case "user":
        return blocks(ev.message.content).flatMap((b): LlmEvent[] =>
          b.type === "tool_result" && !internal.has(b.tool_use_id)
            ? [{ type: "tool_result", id: b.tool_use_id, output: b.content, isError: b.is_error }]
            : [],
        );
      case "result":
        return resultEvents(ev);
    }
  });
}

function resultEvents(ev: Extract<z.infer<typeof line>, { type: "result" }>): LlmEvent[] {
  const out: LlmEvent[] = [];
  if (ev.usage) {
    out.push({
      type: "usage",
      usage: {
        inputTokens: ev.usage.input_tokens,
        outputTokens: ev.usage.output_tokens,
        cacheReadTokens: ev.usage.cache_read_input_tokens,
        cacheWriteTokens: ev.usage.cache_creation_input_tokens,
        costUsd: ev.total_cost_usd,
      },
    });
  }
  if (ev.structured_output !== undefined)
    out.push({ type: "structured", value: ev.structured_output });
  if (ev.is_error)
    out.push({ type: "error", message: ev.result || "Claude Code reported an error" });
  out.push({ type: "done", stopReason: ev.stop_reason ?? undefined });
  return out;
}
