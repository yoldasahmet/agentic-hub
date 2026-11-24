import { z } from "zod";

export const llmUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheWriteTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  /** Set when the provider reports its own cost; otherwise priced from the catalog. */
  costUsd: z.number().nonnegative().optional(),
});
export type LlmUsage = z.infer<typeof llmUsageSchema>;

/**
 * The normalized stream every provider emits, whatever its wire format.
 * Text and thinking arrive as deltas; `usage` may come more than once
 * (the last one wins); `done` is always the final event.
 */
export const llmEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), delta: z.string() }),
  z.object({ type: z.literal("thinking"), delta: z.string() }),
  z.object({
    type: z.literal("tool_call"),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal("tool_result"),
    id: z.string(),
    output: z.unknown(),
    isError: z.boolean().default(false),
  }),
  z.object({ type: z.literal("structured"), value: z.unknown() }),
  z.object({ type: z.literal("usage"), usage: llmUsageSchema }),
  z.object({ type: z.literal("error"), message: z.string(), code: z.string().optional() }),
  z.object({ type: z.literal("done"), stopReason: z.string().optional() }),
]);
export type LlmEvent = z.infer<typeof llmEventSchema>;
export type LlmEventType = LlmEvent["type"];
