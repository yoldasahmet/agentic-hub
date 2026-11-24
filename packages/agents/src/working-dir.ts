import { isAbsolute } from "node:path";
import { AppError, type WorkingDirPolicy } from "@agentic/contracts";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { AgentRuntimeDeps } from "./deps";
import { workspaceOf } from "./workspace";

/**
 * Resolves where a CLI-backed call or tool runs. cli-bridge validates the
 * directory again before spawning; this picks it, holds it to the
 * workspace's allowed folders, and asks the host for the run's worktree
 * under the `worktree` policy.
 */
export async function resolveWorkingDir(
  policy: WorkingDirPolicy,
  input: Record<string, unknown>,
  deps: AgentRuntimeDeps,
  config: LangGraphRunnableConfig,
): Promise<string> {
  if (policy.mode === "scratch") return deps.scratchDir;
  if (policy.mode === "worktree") return worktreeOf(policy.field, input, deps, config);
  const path = policy.mode === "fixed" ? policy.path : input[policy.field];
  if (typeof path !== "string" || !isAbsolute(path)) {
    const where = policy.mode === "fixed" ? "The working dir" : `Input "${policy.field}"`;
    throw new AppError("validation_failed", `${where} must be an absolute path`);
  }
  // A path can come from a trigger or a workflow input, so it gets the tools' allowlist.
  return deps.tools.checkDir(workspaceOf(config), path);
}

async function worktreeOf(
  field: string,
  input: Record<string, unknown>,
  deps: AgentRuntimeDeps,
  config: LangGraphRunnableConfig,
): Promise<string> {
  const repo = input[field];
  if (typeof repo !== "string" || !repo.trim()) {
    throw new AppError(
      "validation_failed",
      `Input "${field}" must name a repo (owner/name or a path)`,
    );
  }
  const runId: unknown = config.configurable?.run_id;
  if (!deps.worktrees || typeof runId !== "string") {
    throw new AppError("unavailable", "Worktrees are only available inside a run");
  }
  return deps.worktrees.forRun({
    workspaceId: workspaceOf(config),
    runId,
    repo: repo.trim(),
    signal: config.signal,
  });
}
