import {
  AppError,
  type AuthSession,
  type AuthStatus,
  type DbMode,
  type SignInInput,
  type SignUpInput,
  signInInputSchema,
  signUpInputSchema,
} from "@agentic/contracts";
import { moduleLogger } from "@agentic/logger";
import { dummyHash, hashPassword, verifyPassword } from "./password";
import type { Principal } from "./principal";
import { SignInLimiter } from "./rate-limit";
import { type AuthRepository, toUser, type UserRow } from "./repository";
import type { SessionRepository } from "./session-repository";
import {
  hashSessionToken,
  newSessionToken,
  SESSION_RENEW_MS,
  SESSION_TTL_MS,
} from "./session-token";
import type { AuthSettingsRepository } from "./settings-repository";

const log = moduleLogger("core.auth");

/**
 * Sign-up, sign-in, sign-out, and turning a request's session token into a
 * `Principal`. The local DB may auto sign in as the workspace owner; a team
 * DB always needs a session (P17.3).
 */
export class AuthSessionService {
  private workspace: Promise<{ id: string; name: string }> | undefined;

  constructor(
    private readonly repo: AuthRepository,
    private readonly sessions: SessionRepository,
    private readonly settings: AuthSettingsRepository,
    private readonly dbMode: DbMode,
    private readonly limiter = new SignInLimiter(),
  ) {}

  defaultWorkspace(): Promise<{ id: string; name: string }> {
    this.workspace ??= this.repo.defaultWorkspace();
    return this.workspace;
  }

  /** Null when nobody is signed in and auto sign-in doesn't apply. */
  async resolve(token: string | undefined): Promise<Principal | undefined> {
    if (token) return this.fromSession(token);
    return this.autoSignIn();
  }

  async status(principal: Principal | undefined): Promise<AuthStatus> {
    const workspace = await this.defaultWorkspace();
    const settings = await this.settings.get(workspace.id);
    return {
      dbMode: this.dbMode,
      autoSignInAvailable: this.dbMode === "local",
      autoSignIn: this.dbMode === "local" && settings.autoSignIn,
      hasAccounts: await this.repo.hasAccounts(),
      user: principal?.user ?? null,
      workspace: principal?.workspace ?? null,
      role: principal?.role ?? null,
      signedIn: principal?.via === "session",
    };
  }

  async signUp(raw: SignUpInput): Promise<AuthSession> {
    const input = signUpInputSchema.parse(raw);
    const workspace = await this.defaultWorkspace();
    const { user, role } = await this.repo.createAccount({
      email: input.email,
      displayName: input.displayName,
      passwordHash: await hashPassword(input.password),
      workspaceId: workspace.id,
    });
    log.info({ userId: user.id, role }, "account created");
    return this.startSession(user.id, input.client, { user, workspace, role });
  }

  async signIn(raw: SignInInput): Promise<AuthSession> {
    const input = signInInputSchema.parse(raw);
    this.limiter.check(input.email);
    const user = await this.repo.userByEmail(input.email);
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash()));
    const workspace = await this.defaultWorkspace();
    const membership = user && ok ? await this.repo.membership(workspace.id, user.id) : undefined;
    if (!user || !membership) {
      this.limiter.fail(input.email);
      log.info({ client: input.client }, "sign-in refused");
      throw new AppError("auth.invalid_credentials", "Wrong email or password");
    }
    this.limiter.succeed(input.email);
    log.info({ userId: user.id, client: input.client }, "signed in");
    return this.startSession(user.id, input.client, { user: toUser(user), ...membership });
  }

  async signOut(principal: Principal | undefined): Promise<void> {
    if (principal?.tokenHash) await this.sessions.delete(principal.tokenHash);
  }

  private async startSession(
    userId: string,
    client: string,
    rest: Omit<AuthSession, "token" | "expiresAt">,
  ): Promise<AuthSession> {
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.sessions.create({
      userId,
      workspaceId: rest.workspace.id,
      tokenHash: hashSessionToken(token),
      client,
      expiresAt,
    });
    return { token, expiresAt: expiresAt.toISOString(), ...rest };
  }

  private async fromSession(token: string): Promise<Principal> {
    const tokenHash = hashSessionToken(token);
    const found = await this.sessions.principal(tokenHash);
    if (!found) {
      throw new AppError("auth.session_invalid", "Your session has expired. Sign in again.");
    }
    if (found.expiresAt.getTime() - Date.now() < SESSION_RENEW_MS) {
      await this.sessions.renew(found.sessionId, new Date(Date.now() + SESSION_TTL_MS));
    }
    return this.principal(found.user, found.workspace, found.role, "session", tokenHash);
  }

  private async autoSignIn(): Promise<Principal | undefined> {
    if (this.dbMode !== "local") return undefined;
    const workspace = await this.defaultWorkspace();
    if (!(await this.settings.get(workspace.id)).autoSignIn) return undefined;
    const owner = await this.repo.firstOwner(workspace.id);
    return owner && this.principal(owner, workspace, "owner", "auto");
  }

  private principal(
    user: UserRow,
    workspace: { id: string; name: string },
    role: Principal["role"],
    via: Principal["via"],
    tokenHash?: string,
  ): Principal {
    const ctx = { workspaceId: workspace.id, userId: user.id };
    return { ctx, user: toUser(user), workspace, role, via, tokenHash };
  }
}
