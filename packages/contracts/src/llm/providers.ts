import { z } from "zod";

/**
 * Provider ids are an open set ("claude-code", "codex", "gemini",
 * "opencode", "openrouter", …): providers are code plugins, so adding one
 * never needs a migration.
 */
export const providerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const llmTransportSchema = z.enum(["cli", "api"]);
export type LlmTransport = z.infer<typeof llmTransportSchema>;

/**
 * What a provider can do. `structuredOutput` is "native" when the provider
 * takes a JSON Schema itself; otherwise the caller extracts and validates.
 */
export const providerCapabilitiesSchema = z.object({
  streaming: z.boolean(),
  tools: z.boolean(),
  structuredOutput: z.enum(["native", "extract"]),
  reasoning: z.boolean(),
  images: z.boolean(),
  /** Runs MCP servers itself when given them (a CLI's own MCP client). */
  mcp: z.boolean().default(false),
});
export type ProviderCapabilities = z.infer<typeof providerCapabilitiesSchema>;

/** `detect()`: installed, version, signed in. `signedIn` is null when it can't be told. */
export const providerStatusSchema = z.object({
  id: providerIdSchema,
  name: z.string(),
  transport: llmTransportSchema,
  capabilities: providerCapabilitiesSchema,
  installed: z.boolean(),
  version: z.string().optional(),
  path: z.string().optional(),
  signedIn: z.boolean().nullable(),
  detail: z.string().optional(),
});
export type ProviderStatus = z.infer<typeof providerStatusSchema>;
