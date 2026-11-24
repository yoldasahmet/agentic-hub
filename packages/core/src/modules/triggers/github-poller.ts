import { AppError } from "@agentic/contracts";
import { type GithubConnection, itemInput, pollGithub } from "@agentic/integrations";
import { triggerConfigSchema } from "./config";
import type { TriggerRepository } from "./repository";
import type { TriggerService } from "./service";

/**
 * The `trigger.github.poll` job: asks GitHub for new matching items, saves
 * the cursor first (so a crash can't fire an item twice), then starts one
 * run per item with the item in the workflow's inputs.
 */
export class GithubPoller {
  constructor(
    private readonly repo: TriggerRepository,
    private readonly triggers: TriggerService,
    private readonly conn: GithubConnection,
  ) {}

  async poll(triggerId: string): Promise<void> {
    const row = await this.repo.getById(triggerId);
    if (!row?.enabled || row.kind !== "github") return;
    const config = triggerConfigSchema.parse(row.config);
    if (!config.github) return;
    let found: Awaited<ReturnType<typeof pollGithub>>;
    try {
      found = await pollGithub(await this.conn.api(), config.github, config.githubState);
    } catch (err) {
      const lastError = AppError.from(err).message;
      await this.repo.update(row.id, { config: { ...config, lastError } });
      return;
    }
    let current = await this.repo.update(row.id, {
      config: { ...config, githubState: found.state },
    });
    for (const item of found.items) {
      await this.triggers.startWith(current, itemInput(config.github, item)).catch(() => undefined);
      current = (await this.repo.getById(row.id)) ?? current;
    }
  }
}
