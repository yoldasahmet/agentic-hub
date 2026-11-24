import { AppError, type JiraSettings } from "@agentic/contracts";
import { JiraApi } from "../api/client";

export type JiraConnectionOptions = {
  /** The vault token, read fresh on each call. */
  token(): string | undefined;
  /** The workspace's site and account email. */
  settings(workspaceId: string): Promise<JiraSettings>;
  userAgent: string;
};

/**
 * The one way Core reaches Jira: the workspace's site and email with the
 * vault's API token. The client is rebuilt when any of the three changes.
 */
export class JiraConnection {
  private readonly cached = new Map<string, { id: string; api: JiraApi }>();

  constructor(private readonly options: JiraConnectionOptions) {}

  hasToken(): boolean {
    return Boolean(this.options.token());
  }

  savedToken(): string | undefined {
    return this.options.token();
  }

  settings(workspaceId: string): Promise<JiraSettings> {
    return this.options.settings(workspaceId);
  }

  async api(workspaceId: string): Promise<JiraApi> {
    const { siteUrl, email } = await this.options.settings(workspaceId);
    const token = this.options.token();
    if (!siteUrl || !email || !token) {
      throw new AppError(
        "jira.unauthorized",
        "Connect Jira in Settings → Jira (site, email, and API token).",
      );
    }
    const id = `${siteUrl}\n${email}\n${token}`;
    const hit = this.cached.get(workspaceId);
    if (hit?.id === id) return hit.api;
    const api = this.with({ siteUrl, email, token });
    this.cached.set(workspaceId, { id, api });
    return api;
  }

  /** A client for explicit credentials, e.g. to test them before saving. */
  with(creds: { siteUrl: string; email: string; token: string }): JiraApi {
    return new JiraApi({ ...creds, userAgent: this.options.userAgent });
  }
}
