import { z } from "zod";
import { modelIdSchema } from "./models";

export const llmMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type LlmMessage = z.infer<typeof llmMessageSchema>;

export const jsonSchemaSchema = z.record(z.string(), z.unknown());
export type JsonSchema = z.infer<typeof jsonSchemaSchema>;

export const llmToolSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  description: z.string().default(""),
  inputSchema: jsonSchemaSchema,
});
export type LlmTool = z.infer<typeof llmToolSchema>;

export const reasoningEffortSchema = z.enum(["low", "medium", "high"]);
export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;

/**
 * One call to any provider. CLI providers flatten `messages` into one
 * prompt; `cwd` is where a CLI runs and is validated before spawning.
 */
/** A call without its own `timeoutMs` stops after this, so no CLI or stream runs forever. */
export const DEFAULT_LLM_TIMEOUT_MS = 1_800_000;

export const llmRequestSchema = z.object({
  model: modelIdSchema,
  system: z.string().optional(),
  messages: z.array(llmMessageSchema).min(1),
  /** A JSON Schema the final answer must match. */
  outputSchema: jsonSchemaSchema.optional(),
  tools: z.array(llmToolSchema).optional(),
  reasoning: reasoningEffortSchema.optional(),
  maxTokens: z.number().int().positive().optional(),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().max(3_600_000).optional(),
});
export type LlmRequest = z.infer<typeof llmRequestSchema>;
