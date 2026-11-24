import { z } from "zod";
import { identityColorSchema, identityIconSchema } from "../identity";
import { idSchema, isoDateTimeSchema, slugSchema } from "../ids";
import { workflowDocumentSchema } from "./document";
import { validationIssueSchema } from "./validation";

/** A workflow's identity and its autosaved draft document (D10). */
export const workflowSchema = z.object({
  id: idSchema,
  slug: slugSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  color: identityColorSchema,
  icon: identityIconSchema,
  draft: workflowDocumentSchema,
  /** Bumped by every draft save; a stale revision is a conflict (optimistic lock). */
  revision: z.number().int().nonnegative(),
  latestVersion: z.number().int().positive().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Workflow = z.infer<typeof workflowSchema>;

/** A save returns the workflow and what the validator found in the saved draft. */
export const savedWorkflowSchema = workflowSchema.extend({
  issues: z.array(validationIssueSchema),
});
export type SavedWorkflow = z.infer<typeof savedWorkflowSchema>;

/** An immutable published version: every agent and subworkflow reference is pinned. */
export const workflowVersionSchema = z.object({
  id: idSchema,
  workflowId: idSchema,
  version: z.number().int().positive(),
  document: workflowDocumentSchema,
  createdAt: isoDateTimeSchema,
});
export type WorkflowVersion = z.infer<typeof workflowVersionSchema>;

const identityFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000),
  color: identityColorSchema,
  icon: identityIconSchema,
};

export const createWorkflowInputSchema = z.object({
  ...identityFields,
  description: identityFields.description.default(""),
  color: identityColorSchema.optional(),
  icon: identityIconSchema.optional(),
  slug: slugSchema.optional(),
  document: workflowDocumentSchema.optional(),
});
export type CreateWorkflowInput = z.input<typeof createWorkflowInputSchema>;

export const updateWorkflowInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    ...identityFields,
    slug: slugSchema,
    draft: workflowDocumentSchema,
  })
  .partial()
  .required({ revision: true });
export type UpdateWorkflowInput = z.input<typeof updateWorkflowInputSchema>;

export const publishWorkflowInputSchema = z.object({ revision: z.number().int().nonnegative() });

export const workflowVersionRefSchema = z.union([z.literal("draft"), z.number().int().positive()]);
export type WorkflowVersionRef = z.infer<typeof workflowVersionRefSchema>;

/** Runs the draft (a pinned snapshot of it) or a published version. */
export const runWorkflowInputSchema = z.object({
  version: workflowVersionRefSchema.default("draft"),
  input: z.record(z.string(), z.json()).default({}),
});
export type RunWorkflowInput = z.input<typeof runWorkflowInputSchema>;

/** Retries a stopped run: from its failed node, or from the last time `node` was about to run. */
export const retryWorkflowRunInputSchema = z.object({
  node: z.string().min(1).max(64).optional(),
});
export type RetryWorkflowRunInput = z.infer<typeof retryWorkflowRunInputSchema>;

export const workflowIdParamSchema = z.object({ workflowId: idSchema });
export const workflowListQuerySchema = z.object({ archived: z.enum(["0", "1"]).optional() });
export type WorkflowListQuery = z.infer<typeof workflowListQuerySchema>;
