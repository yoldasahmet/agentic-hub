import { type Trigger, triggerKindSchema } from "@agentic/contracts";
import { triggerConfigSchema } from "./config";
import type { TriggerRow } from "./repository";

export function toTrigger(row: TriggerRow): Trigger {
  const config = triggerConfigSchema.parse(row.config);
  return {
    id: row.id,
    workflowId: row.targetId,
    kind: triggerKindSchema.catch("manual").parse(row.kind),
    name: config.name,
    enabled: row.enabled,
    version: config.version,
    input: config.input,
    schedule: config.schedule,
    github: config.github,
    jira: config.jira,
    nextFireAt: row.nextFireAt?.toISOString() ?? null,
    lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
    lastRunId: config.lastRunId,
    lastError: config.lastError,
    createdAt: row.createdAt.toISOString(),
  };
}
