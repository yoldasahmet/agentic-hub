import type { Database } from "@agentic/db";
import type { GraphRuntime } from "@agentic/graph";
import type { GithubConnection, JiraConnection } from "@agentic/integrations";
import { z } from "zod";
import type { WorkflowModule } from "../workflows/index";
import { GithubPoller } from "./github-poller";
import { JiraPoller } from "./jira-poller";
import { FIRE_JOB_KIND, JIRA_POLL_JOB_KIND, POLL_JOB_KIND, TriggerRepository } from "./repository";
import { TriggerService } from "./service";

/** Due schedules are checked at most this often, on the worker's tick. */
const SWEEP_MS = 10_000;
const firePayloadSchema = z.object({ triggerId: z.string() });

/**
 * Wires triggers into the job host: a throttled sweep claims due schedules
 * and GitHub/Jira polls (exactly once across instances) and enqueues
 * `trigger.fire` jobs, which start the run like "Run now" does, or
 * `trigger.github.poll` / `trigger.jira.poll` jobs, which start one run per
 * new item.
 */
export function createTriggerModule(
  db: Database,
  graph: GraphRuntime,
  workflows: WorkflowModule,
  github: GithubConnection,
  jira: JiraConnection,
) {
  const repo = new TriggerRepository(db);
  const service = new TriggerService(repo, workflows);
  const poller = new GithubPoller(repo, service, github);
  const jiraPoller = new JiraPoller(repo, service, jira);
  let lastSweep = 0;
  graph.jobs.onTick(async () => {
    if (Date.now() - lastSweep < SWEEP_MS) return;
    lastSweep = Date.now();
    await repo.claimDue(graph.jobs);
  });
  graph.jobs.handle(FIRE_JOB_KIND, async (job) => {
    await service.fireFromJob(firePayloadSchema.parse(job.payload).triggerId);
  });
  graph.jobs.handle(POLL_JOB_KIND, async (job) => {
    await poller.poll(firePayloadSchema.parse(job.payload).triggerId);
  });
  graph.jobs.handle(JIRA_POLL_JOB_KIND, async (job) => {
    await jiraPoller.poll(firePayloadSchema.parse(job.payload).triggerId);
  });
  return { service };
}

export type TriggerModule = ReturnType<typeof createTriggerModule>;
