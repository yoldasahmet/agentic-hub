import { z } from "zod";

const absolutePath = z
  .string()
  .min(1)
  .max(1024)
  .refine((path) => path.startsWith("/") && !path.includes("\0"), "Use an absolute path");

/**
 * Workspace limits for every tool call. Tools run only in the scratch dir
 * or inside an allowed folder; an empty list allows none beyond scratch,
 * so reaching a repo is an explicit choice in Settings → Tools.
 */
export const toolGuardrailsSchema = z.object({
  allowedDirs: z.array(absolutePath).max(50).default([]),
  timeoutMs: z.number().int().min(1_000).max(600_000).default(60_000),
  maxOutputBytes: z.number().int().min(1_024).max(1_000_000).default(64_000),
});
export type ToolGuardrails = z.infer<typeof toolGuardrailsSchema>;
export const defaultToolGuardrails: ToolGuardrails = toolGuardrailsSchema.parse({});
