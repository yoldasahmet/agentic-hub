import type { LlmEvent } from "@agentic/contracts";
import { z } from "zod";

const count = z.number().int().nonnegative().catch(0);

const toolCallDelta = z.looseObject({
  index: z.number().int().nonnegative().catch(0),
  id: z.string().optional(),
  function: z.looseObject({ name: z.string(), arguments: z.string() }).partial().optional(),
});

/** One `chat.completion.chunk`, or an `{ error }` sent mid-stream. */
export const chunkSchema = z.looseObject({
  choices: z
    .array(
      z.looseObject({
        delta: z
          .looseObject({
            content: z.string().nullish(),
            reasoning: z.string().nullish(),
            tool_calls: z.array(toolCallDelta).nullish(),
          })
          .optional(),
        finish_reason: z.string().nullish(),
      }),
    )
    .catch([]),
  usage: z
    .looseObject({
      prompt_tokens: count,
      completion_tokens: count,
      cost: z.number().nonnegative().optional(),
      prompt_tokens_details: z.looseObject({ cached_tokens: count }).nullish(),
      completion_tokens_details: z.looseObject({ reasoning_tokens: count }).nullish(),
    })
    .nullish(),
  error: z
    .looseObject({ message: z.string(), code: z.union([z.string(), z.number()]).optional() })
    .optional(),
});
type Chunk = z.infer<typeof chunkSchema>;

/**
 * Maps chunks to `LlmEvent`s. Tool call arguments stream as JSON string
 * fragments keyed by index; a call is emitted whole once the choice
 * finishes (or the stream ends), with its arguments parsed.
 */
export class ChunkMapper {
  private readonly calls = new Map<number, { id: string; name: string; args: string }>();
  stopReason: string | undefined;

  map(chunk: Chunk): LlmEvent[] {
    const out: LlmEvent[] = [];
    if (chunk.error)
      out.push({
        type: "error",
        message: chunk.error.message,
        code: String(chunk.error.code ?? ""),
      });
    for (const choice of chunk.choices) {
      const delta = choice.delta;
      if (delta?.reasoning) out.push({ type: "thinking", delta: delta.reasoning });
      if (delta?.content) out.push({ type: "text", delta: delta.content });
      for (const call of delta?.tool_calls ?? []) {
        const entry = this.calls.get(call.index) ?? { id: "", name: "", args: "" };
        entry.id ||= call.id ?? "";
        entry.name ||= call.function?.name ?? "";
        entry.args += call.function?.arguments ?? "";
        this.calls.set(call.index, entry);
      }
      if (choice.finish_reason) {
        this.stopReason = choice.finish_reason;
        out.push(...this.flushCalls());
      }
    }
    if (chunk.usage) {
      const u = chunk.usage;
      const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
      out.push({
        type: "usage",
        usage: {
          inputTokens: Math.max(0, u.prompt_tokens - cached),
          outputTokens: u.completion_tokens,
          cacheReadTokens: cached,
          reasoningTokens: u.completion_tokens_details?.reasoning_tokens,
          costUsd: u.cost,
        },
      });
    }
    return out;
  }

  flushCalls(): LlmEvent[] {
    const out = [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(
        ([index, c]): LlmEvent => ({
          type: "tool_call",
          id: c.id || `call_${index}`,
          name: c.name,
          input: parseArgs(c.args),
        }),
      );
    this.calls.clear();
    return out;
  }
}

function parseArgs(args: string): unknown {
  if (!args.trim()) return {};
  try {
    return JSON.parse(args);
  } catch {
    return { _raw: args };
  }
}
