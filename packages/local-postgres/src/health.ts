import { AppError } from "@agentic/contracts";
import pg from "pg";

export type ServerAddress = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/** Runs one query on a fresh connection. Used for readiness and health checks. */
export async function ping(address: ServerAddress, sql = "select 1"): Promise<pg.QueryResult> {
  const client = new pg.Client({ ...address, connectionTimeoutMillis: 2_000 });
  try {
    await client.connect();
    return await client.query(sql);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Polls until the server accepts queries, or fails early when `aborted()` says it died. */
export async function waitUntilReady(
  address: ServerAddress,
  aborted: () => string | undefined,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    const reason = aborted();
    if (reason) throw new AppError("unavailable", `Postgres stopped while starting: ${reason}`);
    try {
      await ping(address);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new AppError("unavailable", `Postgres did not become ready: ${lastError}`);
}

/** Creates the app database on first start. Identifiers come from code, not input. */
export async function ensureDatabase(address: ServerAddress, name: string): Promise<void> {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new AppError("validation_failed", "Bad DB name");
  const admin = { ...address, database: "postgres" };
  const found = await ping(admin, `select 1 from pg_database where datname = '${name}'`);
  if (found.rowCount === 0) await ping(admin, `create database "${name}"`);
}
