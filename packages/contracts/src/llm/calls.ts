import { z } from "zod";
import { appErrorSchema } from "../errors";
import { llmEventSchema, llmUsageSchema } from "./events";
import { modelIdSchema } from "./models";
import { providerIdSchema } from "./providers";
import { jsonSchemaSchema, reasoningEffortSchema } from "./request";

export const modelRefSchema = z.object({ providerId: providerIdSchema, model: modelIdSchema });
export type ModelRef = z.infer<typeof modelRefSchema>;

/** `POST /llm/stream` and `/llm/call`: one prompt to one model. */
export const llmCallInputSchema = modelRefSchema.extend({
  prompt: z.string().min(1).max(200_000),
  system: z.string().max(200_000).optional(),
  outputSchema: jsonSchemaSchema.optional(),
  reasoning: reasoningEffortSchema.optional(),
});
export type LlmCallInput = z.infer<typeof llmCallInputSchema>;

/** One line of the `POST /llm/stream` NDJSON body. */
export const llmStreamLineSchema = z.union([
  z.object({ kind: z.literal("event"), event: llmEventSchema }),
  z.object({ kind: z.literal("result"), result: z.lazy(() => llmCallResultSchema) }),
]);
export type LlmStreamLine = z.infer<typeof llmStreamLineSchema>;

/** Usage and cost for one call. Cost is null when the model has no known price. */
export const llmCallResultSchema = modelRefSchema.extend({
  ok: z.boolean(),
  text: z.string(),
  structured: z.unknown().optional(),
  usage: llmUsageSchema.optional(),
  costUsd: z.number().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative(),
  error: appErrorSchema.optional(),
});
export type LlmCallResult = z.infer<typeof llmCallResultSchema>;

/** `POST /llm/compare`: the same prompt fanned out to several models at once. */
export const llmCompareInputSchema = llmCallInputSchema
  .omit({ providerId: true, model: true })
  .extend({ targets: z.array(modelRefSchema).min(1).max(8) });
export type LlmCompareInput = z.infer<typeof llmCompareInputSchema>;

export const llmCompareResultSchema = z.object({ results: z.array(llmCallResultSchema) });
export type LlmCompareResult = z.infer<typeof llmCompareResultSchema>;
