import {
  AppError,
  type JiraAuthStatus,
  type JiraConnectionResult,
  type JiraConnectionTest,
  type JiraSettings,
  jiraConnectionTestSchema,
  jiraSettingsSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { type JiraConnection, myself } from "@agentic/integrations";
import type { JiraSettingsRepository } from "./settings-repository";

/** Who Core talks to Jira as: the workspace's site and email with the vault's API token. */
export class JiraAuthService {
  constructor(
    private readonly conn: JiraConnection,
    private readonly settings: JiraSettingsRepository,
  ) {}

  async status(ctx: LocalContext): Promise<JiraAuthStatus> {
    const { siteUrl, email } = await this.settings.get(ctx.workspaceId);
    const base = { siteUrl, email, hasToken: this.conn.hasToken() };
    if (!siteUrl || !email || !base.hasToken) return { ...base, user: null, error: null };
    try {
      return { ...base, user: await myself(await this.conn.api(ctx.workspaceId)), error: null };
    } catch (err) {
      return { ...base, user: null, error: AppError.from(err).message };
    }
  }

  settingsOf(ctx: LocalContext): Promise<JiraSettings> {
    return this.settings.get(ctx.workspaceId);
  }

  setSettings(ctx: LocalContext, raw: JiraSettings): Promise<JiraSettings> {
    return this.settings.set(ctx, jiraSettingsSchema.parse(raw));
  }

  /** The connection test: a site and email with a typed token, or else the saved one. */
  async test(raw: JiraConnectionTest): Promise<JiraConnectionResult> {
    const input = jiraConnectionTestSchema.parse(raw);
    const token = input.token ?? this.conn.savedToken();
    if (!token) return { ok: false, user: null, error: "Add the API token first" };
    try {
      const user = await myself(this.conn.with({ ...input, token }));
      return { ok: true, user, error: null };
    } catch (err) {
      return { ok: false, user: null, error: AppError.from(err).message };
    }
  }
}
