import { z } from "zod";
import { identityColorSchema, identityIconSchema } from "../identity";
import { idSchema, isoDateTimeSchema, slugSchema } from "../ids";
import { modelRefSchema } from "../llm/calls";
import { agentKindSchema, agentSpecSchema } from "./spec";

/** An agent's identity and its autosaved draft (D10). */
export const agentSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  color: identityColorSchema,
  icon: identityIconSchema,
  kind: agentKindSchema,
  draft: agentSpecSchema,
  /** Bumped by every draft save; a stale revision is a conflict (optimistic lock). */
  revision: z.number().int().nonnegative(),
  latestVersion: z.number().int().positive().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Agent = z.infer<typeof agentSchema>;

/** An immutable published version. Runs pin one. */
export const agentVersionSchema = z.object({
  id: idSchema,
  agentId: idSchema,
  version: z.number().int().positive(),
  spec: agentSpecSchema,
  createdAt: isoDateTimeSchema,
});
export type AgentVersion = z.infer<typeof agentVersionSchema>;

const identityFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000),
  color: identityColorSchema,
  icon: identityIconSchema,
};

export const createAgentInputSchema = z.object({
  ...identityFields,
  description: identityFields.description.default(""),
  /** Defaults from the id hash and a bot icon. */
  color: identityColorSchema.optional(),
  icon: identityIconSchema.optional(),
  /** Defaults to a slug of the name, made unique in the workspace. */
  slug: slugSchema.optional(),
  spec: agentSpecSchema.optional(),
});
export type CreateAgentInput = z.input<typeof createAgentInputSchema>;

export const updateAgentInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    ...identityFields,
    slug: slugSchema,
    draft: agentSpecSchema,
  })
  .partial()
  .required({ revision: true });
export type UpdateAgentInput = z.input<typeof updateAgentInputSchema>;

/** Publishing snapshots the current draft. `revision` guards against publishing a stale view. */
export const publishAgentInputSchema = z.object({ revision: z.number().int().nonnegative() });
export type PublishAgentInput = z.infer<typeof publishAgentInputSchema>;

export const agentVersionRefSchema = z.union([z.literal("draft"), z.number().int().positive()]);
export type AgentVersionRef = z.infer<typeof agentVersionRefSchema>;

/**
 * Runs an agent (the playground, later chat and workflows). `model`
 * overrides the configured model for this run only, to compare providers.
 */
export const runAgentInputSchema = z.object({
  version: agentVersionRefSchema.default("draft"),
  input: z.record(z.string(), z.json()).default({}),
  model: modelRefSchema.optional(),
});
export type RunAgentInput = z.input<typeof runAgentInputSchema>;

export const agentIdParamSchema = z.object({ agentId: idSchema });
export const agentVersionParamSchema = agentIdParamSchema.extend({
  version: z.coerce.number().int().positive(),
});

export const agentListQuerySchema = z.object({
  archived: z.enum(["0", "1"]).optional(),
});
export type AgentListQuery = z.infer<typeof agentListQuerySchema>;
