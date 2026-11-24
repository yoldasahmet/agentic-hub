import { isAbsolute, join } from "node:path";
import type { WorktreeProvider } from "@agentic/agents";
import { AppError, repoFullNameSchema, type ToolGuardrails } from "@agentic/contracts";
import { ensureClone, ensureWorktree, type GithubConnection, gitAuth } from "@agentic/integrations";
import { checkToolDir } from "@agentic/tools";

export type WorktreeDeps = {
  conn: GithubConnection;
  gitHost: string;
  /** `<dataDir>/git`: `repos/<owner>/<name>` clones and `worktrees/<run>/…`. */
  root: string;
  scratchDir: string;
  guardrails(workspaceId: string): Promise<ToolGuardrails>;
};

/**
 * One git worktree per run and repo, on branch `agentic/<run>`. GitHub repos
 * are cloned once and fetched before each new worktree; local repos must be
 * inside an allowed folder. Concurrent nodes of a run share one promise.
 */
export class WorktreeService implements WorktreeProvider {
  private readonly pending = new Map<string, Promise<string>>();

  constructor(private readonly deps: WorktreeDeps) {}

  /** Tools may run in worktrees without an allowlist entry: the app made them. */
  get worktreesRoot(): string {
    return join(this.deps.root, "worktrees");
  }

  forRun(req: { workspaceId: string; runId: string; repo: string; signal?: AbortSignal }) {
    const key = `${req.runId}:${req.repo}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const work = this.create(req).finally(() => this.pending.delete(key));
    this.pending.set(key, work);
    return work;
  }

  private async create(req: {
    workspaceId: string;
    runId: string;
    repo: string;
    signal?: AbortSignal;
  }): Promise<string> {
    const source = await this.source(req);
    const name = req.repo.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+/, "");
    const path = join(this.worktreesRoot, req.runId, name || "repo");
    return ensureWorktree(source.path, path, `agentic/run-${req.runId.slice(-8)}`, source.base);
  }

  private async source(req: { workspaceId: string; repo: string; signal?: AbortSignal }) {
    if (repoFullNameSchema.safeParse(req.repo).success) {
      const clone = this.serialized(req.repo, async () =>
        ensureClone(
          join(this.deps.root, "repos"),
          req.repo,
          await gitAuth(this.deps.conn, this.deps.gitHost),
          req.signal,
        ),
      );
      return { path: await clone, base: "origin/HEAD" };
    }
    if (!isAbsolute(req.repo)) {
      throw new AppError(
        "validation_failed",
        `"${req.repo}" is neither owner/name nor an absolute path`,
      );
    }
    const rules = await this.deps.guardrails(req.workspaceId);
    const path = await checkToolDir(req.repo, {
      scratchDir: this.deps.scratchDir,
      allowedDirs: rules.allowedDirs,
    });
    return { path, base: "HEAD" };
  }

  /** Two runs fetching the same clone at once would fight over git's locks. */
  private serialized(repo: string, work: () => Promise<string>): Promise<string> {
    const key = `clone:${repo}`;
    const before = this.pending.get(key) ?? Promise.resolve("");
    const next = before.catch(() => "").then(work);
    this.pending.set(key, next);
    void next
      .finally(() => {
        if (this.pending.get(key) === next) this.pending.delete(key);
      })
      .catch(() => undefined);
    return next;
  }
}
