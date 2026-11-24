import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  bootstrapLocalWorkspace,
  defaultMigrationsFolder,
  migrateDatabase,
  openDatabase,
} from "@agentic/db";
import { createEmptyDatabase, type EmptyDatabase } from "@agentic/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

async function journalLength(): Promise<number> {
  const raw = await readFile(join(defaultMigrationsFolder, "meta", "_journal.json"), "utf8");
  const journal: { entries: unknown[] } = JSON.parse(raw);
  return journal.entries.length;
}

describe("migrations", () => {
  let db: EmptyDatabase;
  beforeEach(async () => {
    db = await createEmptyDatabase();
  });
  afterEach(() => db.drop());

  it("applies every migration once and is idempotent", async () => {
    const expected = await journalLength();
    expect((await migrateDatabase(db.handle.pool)).applied).toBe(expected);
    expect((await migrateDatabase(db.handle.pool)).applied).toBe(expected);
    const tables = await db.handle.pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const names = tables.rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(["workspaces", "users", "agents", "workflows"]));
  });

  it("serializes concurrent migrators sharing one database", async () => {
    // Two app instances on a team DB start at the same time.
    const other = openDatabase({ mode: "remote", connectionString: db.url, tls: "disable" });
    try {
      const results = await Promise.all([
        migrateDatabase(db.handle.pool),
        migrateDatabase(other.pool),
      ]);
      const expected = await journalLength();
      expect(results.map((r) => r.applied)).toEqual([expected, expected]);
    } finally {
      await other.close();
    }
  });

  it("bootstraps one default workspace even when instances race", async () => {
    await migrateDatabase(db.handle.pool);
    const contexts = await Promise.all(
      Array.from({ length: 4 }, () => bootstrapLocalWorkspace(db.handle.db)),
    );
    const ids = new Set(contexts.map((c) => c.workspaceId));
    expect(ids.size).toBe(1);
    const count = await db.handle.pool.query<{ n: string }>("select count(*) as n from workspaces");
    expect(Number(count.rows[0]?.n)).toBe(1);
  });
});
