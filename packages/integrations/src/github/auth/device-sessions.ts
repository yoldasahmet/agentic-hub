import { randomUUID } from "node:crypto";
import type { DeviceFlowStart, DeviceFlowState } from "@agentic/contracts";
import { AppError } from "@agentic/contracts";
import { pollDeviceToken, requestDeviceCode } from "./device-flow";

type Session = { state: DeviceFlowState; expiresAt: number; timer?: NodeJS.Timeout };

/**
 * Device sign-ins in progress. Core polls GitHub in the background and
 * hands the token to `onToken` (main stores it in the vault); the UI only
 * ever sees the user code and the session state, never the token.
 */
export class DeviceFlowSessions {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly webUrl: string,
    private readonly onToken: (token: string) => Promise<void>,
  ) {}

  async start(clientId: string): Promise<DeviceFlowStart> {
    if (!clientId) {
      throw new AppError("validation_failed", "Set the OAuth app client id first");
    }
    const code = await requestDeviceCode(clientId, this.webUrl);
    const flowId = randomUUID();
    const session: Session = {
      state: { status: "pending", error: null },
      expiresAt: Date.now() + code.expires_in * 1000,
    };
    this.sessions.set(flowId, session);
    const tick = async (interval: number) => {
      if (Date.now() > session.expiresAt)
        return this.finish(session, "expired", "The code expired");
      const result = await pollDeviceToken(clientId, code.device_code, this.webUrl).catch(
        (err: unknown) => ({ status: "failed" as const, error: AppError.from(err).message }),
      );
      if (result.status === "pending") {
        const next = result.interval ?? interval;
        session.timer = setTimeout(() => void tick(next), next * 1000);
      } else if (result.status === "done") {
        await this.onToken(result.token)
          .then(() => this.finish(session, "done", null))
          .catch((err: unknown) => this.finish(session, "failed", AppError.from(err).message));
      } else {
        this.finish(session, result.status, result.error);
      }
    };
    session.timer = setTimeout(() => void tick(code.interval), code.interval * 1000);
    return {
      flowId,
      userCode: code.user_code,
      verificationUri: code.verification_uri,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  state(flowId: string): DeviceFlowState {
    const session = this.sessions.get(flowId);
    if (!session) throw new AppError("not_found", "No such sign-in");
    return session.state;
  }

  cancel(flowId: string): void {
    const session = this.sessions.get(flowId);
    if (session) this.finish(session, "denied", "Sign-in was cancelled");
  }

  stopAll(): void {
    for (const session of this.sessions.values()) clearTimeout(session.timer);
    this.sessions.clear();
  }

  private finish(session: Session, status: DeviceFlowState["status"], error: string | null): void {
    clearTimeout(session.timer);
    session.state = { status, error };
  }
}
