import { z } from "zod";
import { providerIdSchema } from "./providers";

export const modelIdSchema = z.string().min(1).max(200);

export const modelTierSchema = z.enum(["fast", "balanced", "deep"]);
export type ModelTier = z.infer<typeof modelTierSchema>;

/** USD per million tokens. */
export const modelPricingSchema = z.object({
  inputPerMTok: z.number().nonnegative(),
  outputPerMTok: z.number().nonnegative(),
  cacheReadPerMTok: z.number().nonnegative().optional(),
  cacheWritePerMTok: z.number().nonnegative().optional(),
});
export type ModelPricing = z.infer<typeof modelPricingSchema>;

export const modelInfoSchema = z.object({
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  label: z.string().min(1),
  tier: modelTierSchema.optional(),
  contextWindow: z.number().int().positive().optional(),
  supportsReasoning: z.boolean().default(false),
  pricing: modelPricingSchema.optional(),
});
export type ModelInfo = z.infer<typeof modelInfoSchema>;

export const modelSourceSchema = z.enum(["catalog", "openrouter"]);
export type ModelSource = z.infer<typeof modelSourceSchema>;

/** A model as Settings and pickers see it: catalog data plus the workspace's choice. */
export const modelEntrySchema = modelInfoSchema.extend({
  source: modelSourceSchema,
  enabled: z.boolean(),
  isDefault: z.boolean().default(false),
});
export type ModelEntry = z.infer<typeof modelEntrySchema>;

/** `packages/llm/config/llm-catalog.json`: hand-edited data, parsed at load. */
export const llmCatalogSchema = z.object({
  providers: z.array(
    z.object({
      id: providerIdSchema,
      reasoningOptions: z.array(z.string()).default([]),
      models: z.array(
        modelInfoSchema
          .omit({ providerId: true })
          .extend({ isDefault: z.boolean().default(false) }),
      ),
    }),
  ),
});
export type LlmCatalog = z.infer<typeof llmCatalogSchema>;

export const setModelEnabledInputSchema = z.object({
  providerId: providerIdSchema,
  modelId: modelIdSchema,
  enabled: z.boolean(),
});
export type SetModelEnabledInput = z.infer<typeof setModelEnabledInputSchema>;

export const modelSyncResultSchema = z.object({ synced: z.number().int().nonnegative() });
