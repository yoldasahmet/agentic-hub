import type { Database } from "@agentic/db";
import { sql } from "drizzle-orm";

export type RecoveredJob = { id: string; runId: string | null; status: string };

/**
 * Hands back jobs whose holder stopped heartbeating. A job flagged for
 * cancel becomes canceled; one out of attempts becomes failed; the rest
 * are queued again, so their runs resume from the last checkpoint.
 */
export async function recoverExpiredJobs(db: Database): Promise<RecoveredJob[]> {
  const result = await db.execute(sql`
    update jobs set
      status = case
        when status = 'canceling' then 'canceled'
        when attempts >= max_attempts then 'failed'
        else 'queued' end,
      last_error = coalesce(last_error, 'Lease expired'),
      lease_owner = null, lease_expires_at = null, updated_at = now()
    where status in ('running', 'canceling') and lease_expires_at < now()
    returning id, run_id, status`);
  return result.rows.map(toRecovered);
}

/**
 * After an app restart on the same machine, the previous Core's leases
 * would block its runs until they expire. Owners are `<host>:<pid>:<n>`,
 * so a dead pid on this host means the lease can be reclaimed now.
 */
export async function recoverOrphanedJobs(
  db: Database,
  hostPrefix: string,
  isAlive: (pid: number) => boolean,
): Promise<RecoveredJob[]> {
  const held = await db.execute(sql`
    select distinct lease_owner from jobs
    where status in ('running', 'canceling') and lease_owner like ${`${hostPrefix}:%`}`);
  const dead = held.rows
    .map((r) => String(r.lease_owner))
    .filter((owner) => !isAlive(Number(owner.slice(hostPrefix.length + 1).split(":")[0])));
  if (dead.length === 0) return [];
  const result = await db.execute(sql`
    update jobs set lease_expires_at = now() - interval '1 second'
    where lease_owner in (${sql.join(
      dead.map((owner) => sql`${owner}`),
      sql`, `,
    )})`);
  return result.rowCount ? recoverExpiredJobs(db) : [];
}

function toRecovered(row: Record<string, unknown>): RecoveredJob {
  return {
    id: String(row.id),
    runId: row.run_id === null ? null : String(row.run_id),
    status: String(row.status),
  };
}
