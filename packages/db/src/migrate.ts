import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type pg from "pg";

/** Arbitrary app-wide key ("agnt"): one migrator at a time across all app instances. */
const MIGRATION_LOCK_KEY = 0x61676e74;
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

/** The SQL folder next to this package. Bundled hosts copy it and pass their own path. */
export const defaultMigrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Applies pending migrations under a session advisory lock, so app
 * instances sharing a team DB never migrate concurrently. Returns how
 * many migrations the database has applied in total.
 */
export async function migrateDatabase(
  pool: pg.Pool,
  migrationsFolder: string = defaultMigrationsFolder,
): Promise<{ applied: number }> {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    try {
      await migrate(drizzle({ client }), {
        migrationsFolder,
        migrationsSchema: MIGRATIONS_SCHEMA,
        migrationsTable: MIGRATIONS_TABLE,
      });
      const count = await client.query<{ count: string }>(
        `select count(*) from "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`,
      );
      return { applied: Number(count.rows[0]?.count ?? 0) };
    } finally {
      await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
