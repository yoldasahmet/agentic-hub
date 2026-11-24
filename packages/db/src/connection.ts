import { AppError, type ConnectionTestResult, type DbConnectionConfig } from "@agentic/contracts";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { poolConfig } from "./pool-config";
import * as schema from "./schema/index";

export type Database = NodePgDatabase<typeof schema>;

export type DbHandle = {
  db: Database;
  pool: pg.Pool;
  close(): Promise<void>;
};

/** Opens a pooled connection to the local service or a remote team DB. */
export function openDatabase(config: DbConnectionConfig, max = 10): DbHandle {
  const pool = new pg.Pool({
    ...poolConfig(config),
    max,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  // An idle client can error when the server restarts; the pool replaces it.
  pool.on("error", () => undefined);
  const db = drizzle({ client: pool, schema });
  return { db, pool, close: () => pool.end() };
}

/** Connects once, reads the server version, and closes. Errors become `unavailable`. */
export async function testConnection(config: DbConnectionConfig): Promise<ConnectionTestResult> {
  const started = performance.now();
  const client = new pg.Client({ ...poolConfig(config), connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    const result = await client.query<{ server_version: string }>("show server_version");
    const serverVersion = result.rows[0]?.server_version ?? "unknown";
    return { serverVersion, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    throw new AppError("unavailable", err instanceof Error ? err.message : "Connection failed");
  } finally {
    await client.end().catch(() => undefined);
  }
}
