import {
  AppError,
  type DeviceFlowStart,
  type DeviceFlowState,
  type GithubAuthStatus,
  type GithubSettings,
  githubSettingsSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import { DeviceFlowSessions, type GithubConnection, viewer } from "@agentic/integrations";
import type { GithubSettingsRepository } from "./settings-repository";

/**
 * Who Core talks to GitHub as: the vault token, else `gh auth`. Device
 * sign-in tokens go to `storeToken` (main → vault); the UI never sees one.
 */
export class GithubAuthService {
  private readonly devices: DeviceFlowSessions;

  constructor(
    private readonly conn: GithubConnection,
    private readonly settings: GithubSettingsRepository,
    webUrl: string,
    storeToken: (token: string) => Promise<void>,
  ) {
    this.devices = new DeviceFlowSessions(webUrl, storeToken);
  }

  async status(ctx: LocalContext): Promise<GithubAuthStatus> {
    this.conn.refresh();
    const [found, gh, settings] = await Promise.all([
      this.conn.token(),
      this.conn.ghToken(),
      this.settings.get(ctx.workspaceId),
    ]);
    const base = {
      source: found?.source ?? ("none" as const),
      ghAvailable: gh !== undefined,
      deviceFlowAvailable: settings.oauthClientId.length > 0,
    };
    if (!found) return { ...base, login: null, avatarUrl: null, scopes: [], error: null };
    try {
      const me = await viewer(await this.conn.api());
      return { ...base, ...me, error: null };
    } catch (err) {
      const error = AppError.from(err).message;
      return { ...base, login: null, avatarUrl: null, scopes: [], error };
    }
  }

  settingsOf(ctx: LocalContext): Promise<GithubSettings> {
    return this.settings.get(ctx.workspaceId);
  }

  setSettings(ctx: LocalContext, raw: GithubSettings): Promise<GithubSettings> {
    return this.settings.set(ctx, githubSettingsSchema.parse(raw));
  }

  async startDevice(ctx: LocalContext): Promise<DeviceFlowStart> {
    const { oauthClientId } = await this.settings.get(ctx.workspaceId);
    return this.devices.start(oauthClientId);
  }

  deviceState(flowId: string): DeviceFlowState {
    return this.devices.state(flowId);
  }

  cancelDevice(flowId: string): void {
    this.devices.cancel(flowId);
  }

  stop(): void {
    this.devices.stopAll();
  }
}
