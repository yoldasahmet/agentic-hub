import { randomBytes } from "node:crypto";
import {
  bootstrapLocalWorkspace,
  type DbHandle,
  type LocalContext,
  migrateDatabase,
  openDatabase,
} from "@agentic/db";
import pg from "pg";
import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    /** Admin URL of the test server. Each test file creates its own database on it. */
    databaseUrl: string;
  }
}

export type TestDatabase = LocalContext & {
  url: string;
  handle: DbHandle;
  /** Closes the pool and drops the database. */
  drop(): Promise<void>;
};

export type EmptyDatabase = Pick<TestDatabase, "url" | "handle" | "drop">;

/** A new database with nothing in it (migration tests start here). */
export async function createEmptyDatabase(): Promise<EmptyDatabase> {
  const adminUrl = inject("databaseUrl");
  const name = `t_${randomBytes(6).toString("hex")}`;
  await adminQuery(adminUrl, `create database "${name}"`);
  const url = withDatabase(adminUrl, name);
  const handle = openDatabase({ mode: "remote", connectionString: url, tls: "disable" });
  const drop = async () => {
    await handle.close();
    await adminQuery(adminUrl, `drop database if exists "${name}" with (force)`);
  };
  return { url, handle, drop };
}

/**
 * A fresh, migrated database for one test file, with the default
 * workspace and local user, so files run in parallel without sharing rows.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const empty = await createEmptyDatabase();
  await migrateDatabase(empty.handle.pool);
  const context = await bootstrapLocalWorkspace(empty.handle.db);
  return { ...empty, ...context };
}

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function adminQuery(url: string, sql: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
