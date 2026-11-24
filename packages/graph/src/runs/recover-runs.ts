import type { AppError } from "@agentic/contracts";
import type { Database } from "@agentic/db";
import type { JobRow } from "../jobs/job-queue";
import { type RecoveredJob, recoverExpiredJobs, recoverOrphanedJobs } from "../jobs/job-recovery";
import { isTerminal, type RunLifecycle } from "./run-lifecycle";
import type { RunStore } from "./run-store";

type Deps = {
  db: Database;
  runs: RunStore;
  lifecycle: RunLifecycle;
  host: string;
  leaseMs: number;
};

/**
 * Keeps runs in step with recovered jobs. Requeued jobs need nothing: the
 * run stays `running` and its next holder continues from the checkpoint.
 * Jobs that end canceled or failed settle their run here.
 */
export function createRecovery(deps: Deps) {
  let lastSweep = 0;

  async function settle(recovered: RecoveredJob[]): Promise<void> {
    for (const job of recovered) {
      if (!job.runId || job.status === "queued") continue;
      const run = await deps.runs.getById(job.runId);
      if (!run || isTerminal(run.status)) continue;
      if (job.status === "canceled") await deps.lifecycle.transition(run, "canceled");
      else await deps.lifecycle.transition(run, "failed", { error: leaseError() });
    }
  }

  return {
    /** At most twice per lease period: hands back expired leases. */
    async sweep(): Promise<void> {
      if (Date.now() - lastSweep < deps.leaseMs / 2) return;
      lastSweep = Date.now();
      await settle(await recoverExpiredJobs(deps.db));
    },
    /** On start: reclaims leases of this host's previous, now dead, Core process. */
    async reclaimOrphans(): Promise<void> {
      await settle(await recoverOrphanedJobs(deps.db, deps.host, isAlive));
    },
    async giveUp(job: JobRow, error: AppError): Promise<void> {
      const run = job.runId ? await deps.runs.getById(job.runId) : undefined;
      if (run && !isTerminal(run.status)) {
        await deps.lifecycle.transition(run, "failed", { error: error.toJSON() });
      }
    },
  };
}

function leaseError() {
  return { code: "unavailable", message: "The run stopped after too many interrupted attempts" };
}

function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    // ESRCH: gone. EPERM: another user's process, so not our Core either.
    return false;
  }
}
