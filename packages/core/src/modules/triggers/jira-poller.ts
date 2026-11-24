import { AppError } from "@agentic/contracts";
import { type JiraConnection, jiraItemInput, pollJira } from "@agentic/integrations";
import { triggerConfigSchema } from "./config";
import type { TriggerRepository } from "./repository";
import type { TriggerService } from "./service";

/**
 * The `trigger.jira.poll` job: runs the trigger's JQL as its workspace,
 * saves the seen keys first (so a crash can't fire an issue twice), then
 * starts one run per newly matching issue.
 */
export class JiraPoller {
  constructor(
    private readonly repo: TriggerRepository,
    private readonly triggers: TriggerService,
    private readonly conn: JiraConnection,
  ) {}

  async poll(triggerId: string): Promise<void> {
    const row = await this.repo.getById(triggerId);
    if (!row?.enabled || row.kind !== "jira") return;
    const config = triggerConfigSchema.parse(row.config);
    if (!config.jira) return;
    let found: Awaited<ReturnType<typeof pollJira>>;
    try {
      found = await pollJira(await this.conn.api(row.workspaceId), config.jira, config.jiraState);
    } catch (err) {
      const lastError = AppError.from(err).message;
      await this.repo.update(row.id, { config: { ...config, lastError } });
      return;
    }
    let current = await this.repo.update(row.id, {
      config: { ...config, jiraState: found.state },
    });
    for (const issue of found.items) {
      await this.triggers
        .startWith(current, jiraItemInput(config.jira, issue))
        .catch(() => undefined);
      current = (await this.repo.getById(row.id)) ?? current;
    }
  }
}
