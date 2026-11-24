import { z } from "zod";
import { githubTriggerSchema } from "../github/triggers";
import { idSchema, isoDateTimeSchema } from "../ids";
import { jiraTriggerSchema } from "../jira/triggers";
import { versionPinSchema } from "./document";

/** Open set stored as text. */
export const triggerKinds = ["manual", "schedule", "github", "jira"] as const;
export const triggerKindSchema = z.enum(triggerKinds);
export type TriggerKind = z.infer<typeof triggerKindSchema>;

/** Five-field cron (minute hour day month weekday) in an IANA time zone. */
export const triggerScheduleSchema = z.object({
  cron: z.string().trim().min(9).max(120),
  timezone: z.string().min(1).max(64).default("UTC"),
});
export type TriggerSchedule = z.infer<typeof triggerScheduleSchema>;

/** Starts a published workflow version with saved inputs: by hand, on a schedule, or on GitHub or Jira activity. */
export const triggerSchema = z.object({
  id: idSchema,
  workflowId: idSchema,
  kind: triggerKindSchema,
  name: z.string().min(1).max(120),
  enabled: z.boolean(),
  version: versionPinSchema,
  input: z.record(z.string(), z.json()),
  schedule: triggerScheduleSchema.nullable(),
  github: githubTriggerSchema.nullable(),
  jira: jiraTriggerSchema.nullable(),
  nextFireAt: isoDateTimeSchema.nullable(),
  lastFiredAt: isoDateTimeSchema.nullable(),
  lastRunId: idSchema.nullable(),
  lastError: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type Trigger = z.infer<typeof triggerSchema>;

export const createTriggerInputSchema = z.object({
  kind: triggerKindSchema,
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().default(true),
  version: versionPinSchema.default("latest"),
  input: z.record(z.string(), z.json()).default({}),
  schedule: triggerScheduleSchema.optional(),
  github: githubTriggerSchema.optional(),
  jira: jiraTriggerSchema.optional(),
});
export type CreateTriggerInput = z.input<typeof createTriggerInputSchema>;

export const updateTriggerInputSchema = createTriggerInputSchema
  .omit({ kind: true })
  .partial()
  .extend({
    schedule: triggerScheduleSchema.nullable().optional(),
    github: githubTriggerSchema.nullable().optional(),
    jira: jiraTriggerSchema.nullable().optional(),
  });
export type UpdateTriggerInput = z.input<typeof updateTriggerInputSchema>;

export const triggerIdParamSchema = z.object({ triggerId: idSchema });
