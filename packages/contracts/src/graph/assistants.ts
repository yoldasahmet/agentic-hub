import { z } from "zod";

/** Registry key of a runnable graph, e.g. "sample" or later "agent:<id>". */
export const assistantIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9][a-z0-9:._@-]*$/, "Use lowercase letters, digits, and : . _ @ -");
export type AssistantId = z.infer<typeof assistantIdSchema>;

/** A graph Core can run. Runs pin `version`, so a new version never changes old runs. */
export const assistantSchema = z.object({
  id: assistantIdSchema,
  name: z.string(),
  description: z.string(),
  version: z.number().int().positive(),
  /** Node names, for "write as node" when editing state. */
  nodes: z.array(z.string()),
});
export type Assistant = z.infer<typeof assistantSchema>;
