import {
  AppError,
  githubTriggerSchema,
  idSchema,
  jiraTriggerSchema,
  type TriggerSchedule,
  triggerScheduleSchema,
  versionPinSchema,
} from "@agentic/contracts";
import { githubPollStateSchema, jiraPollStateSchema } from "@agentic/integrations";
import { CronExpressionParser } from "cron-parser";
import { z } from "zod";

/** What a trigger row keeps in its `config` jsonb (open set, no migration per field). */
export const triggerConfigSchema = z.object({
  name: z.string().min(1).max(120),
  version: versionPinSchema.default("latest"),
  input: z.record(z.string(), z.json()).default({}),
  schedule: triggerScheduleSchema.nullable().default(null),
  github: githubTriggerSchema.nullable().default(null),
  /** What a GitHub trigger already saw (cursor and fired items). */
  githubState: githubPollStateSchema.default({ since: null, seen: [] }),
  jira: jiraTriggerSchema.nullable().default(null),
  /** What a Jira trigger already saw (baseline and fired keys). */
  jiraState: jiraPollStateSchema.default({ primed: false, seen: [] }),
  lastRunId: idSchema.nullable().default(null),
  lastError: z.string().nullable().default(null),
});
export type TriggerConfig = z.infer<typeof triggerConfigSchema>;

/** The next time a cron fires after `after`; a bad expression or zone is a validation error. */
export function nextFire(schedule: TriggerSchedule, after = new Date()): Date {
  try {
    const cron = CronExpressionParser.parse(schedule.cron, {
      currentDate: after,
      tz: schedule.timezone,
    });
    return cron.next().toDate();
  } catch (err) {
    throw new AppError("validation_failed", `Invalid schedule "${schedule.cron}"`, {
      cause: err instanceof Error ? err.message : String(err),
    });
  }
}

/** When an enabled trigger is next due: its cron time, or right away for a GitHub or Jira poll. */
export function firstFire(config: TriggerConfig, enabled: boolean): Date | null {
  if (!enabled) return null;
  if (config.schedule) return nextFire(config.schedule);
  return config.github || config.jira ? new Date() : null;
}

/** The poll after this one, `intervalSeconds` from now. */
export function nextPoll(config: TriggerConfig): Date | null {
  const seconds = config.github?.intervalSeconds ?? config.jira?.intervalSeconds;
  return seconds === undefined ? null : new Date(Date.now() + seconds * 1000);
}
