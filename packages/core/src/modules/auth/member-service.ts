import {
  AppError,
  type AuthSettingsInput,
  type DbMode,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@agentic/contracts";
import { moduleLogger } from "@agentic/logger";
import { type Principal, requireOwner } from "./principal";
import type { AuthRepository } from "./repository";
import type { AuthSettingsRepository } from "./settings-repository";

const log = moduleLogger("core.auth");

/** Members of the signed-in user's workspace and its sign-in settings. Changes are owner-only. */
export class MemberService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly settings: AuthSettingsRepository,
    private readonly dbMode: DbMode,
  ) {}

  list(principal: Principal): Promise<WorkspaceMember[]> {
    return this.repo.members(principal.ctx.workspaceId);
  }

  async setRole(principal: Principal, userId: string, role: WorkspaceRole): Promise<void> {
    requireOwner(principal);
    const { workspaceId } = principal.ctx;
    if (role === "member") await this.keepAnOwner(workspaceId, userId);
    if (!(await this.repo.setRole(workspaceId, userId, role))) {
      throw new AppError("not_found", "No such member");
    }
    log.info({ userId, role, by: principal.user.id }, "member role changed");
  }

  async remove(principal: Principal, userId: string): Promise<void> {
    requireOwner(principal);
    if (userId === principal.user.id) {
      throw new AppError("validation_failed", "You can't remove yourself from the workspace");
    }
    await this.keepAnOwner(principal.ctx.workspaceId, userId);
    if (!(await this.repo.removeMember(principal.ctx.workspaceId, userId))) {
      throw new AppError("not_found", "No such member");
    }
    log.info({ userId, by: principal.user.id }, "member removed");
  }

  /**
   * Auto sign-in is a local-DB convenience. Turning it off needs an owner
   * with a password, or nobody could sign in afterwards.
   */
  async setSettings(principal: Principal, input: AuthSettingsInput): Promise<void> {
    requireOwner(principal);
    if (this.dbMode !== "local") {
      throw new AppError("validation_failed", "A team database always requires sign-in");
    }
    if (!input.autoSignIn) {
      const owner = await this.repo.firstOwner(principal.ctx.workspaceId);
      if (!owner?.passwordHash) {
        throw new AppError(
          "validation_failed",
          "Create an account first, so you can sign in once auto sign-in is off",
        );
      }
    }
    await this.settings.set(principal.ctx, { autoSignIn: input.autoSignIn });
    log.info({ autoSignIn: input.autoSignIn, by: principal.user.id }, "auth settings changed");
  }

  private async keepAnOwner(workspaceId: string, userId: string): Promise<void> {
    if ((await this.repo.countOwners(workspaceId, userId)) === 0) {
      throw new AppError("validation_failed", "A workspace needs at least one owner");
    }
  }
}
