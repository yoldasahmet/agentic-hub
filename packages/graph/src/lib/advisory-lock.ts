import type pg from "pg";

/** Runs `task` while holding a session advisory lock, so app instances sharing a DB take turns. */
export async function withAdvisoryLock<T>(
  pool: pg.Pool,
  key: number,
  task: () => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [key]);
    try {
      return await task();
    } finally {
      await client.query("select pg_advisory_unlock($1)", [key]);
    }
  } finally {
    client.release();
  }
}
