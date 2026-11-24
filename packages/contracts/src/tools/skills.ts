import { z } from "zod";
import { idSchema, isoDateTimeSchema, slugSchema } from "../ids";

/**
 * A skill is instructions an agent or CLI session loads into its context:
 * `inline` keeps Markdown in the row; `directory` points at a local folder
 * with a `SKILL.md`, read each time it is used so edits apply at once.
 */
export const skillSourceSchema = z.enum(["inline", "directory"]);
export type SkillSource = z.infer<typeof skillSourceSchema>;

export const skillSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: slugSchema,
  source: skillSourceSchema,
  content: z.string().nullable(),
  path: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Skill = z.infer<typeof skillSchema>;

const name = z.string().trim().min(1).max(120);
export const skillInputSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("inline"),
    name,
    slug: slugSchema.optional(),
    content: z.string().trim().min(1).max(100_000),
  }),
  z.object({
    source: z.literal("directory"),
    name,
    slug: slugSchema.optional(),
    path: z
      .string()
      .min(1)
      .max(1024)
      .refine((p) => p.startsWith("/"), "Use an absolute path"),
  }),
]);
export type SkillInput = z.infer<typeof skillInputSchema>;

/** A skill as it travels in a workflow bundle: always inline Markdown. */
export const bundledSkillSchema = z.object({
  slug: slugSchema,
  name,
  content: z.string().trim().min(1).max(100_000),
});
export type BundledSkill = z.infer<typeof bundledSkillSchema>;

/** A skill's text as an agent or CLI session gets it. */
export type ResolvedSkill = { slug: string; name: string; content: string };
