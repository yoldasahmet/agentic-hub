import { type ChildProcess, execFile, spawn } from "node:child_process";
import { mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createEmptyDatabase, type EmptyDatabase } from "@agentic/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

const run = promisify(execFile);
const bundleScript = fileURLToPath(new URL("../scripts/bundle.mjs", import.meta.url));
const serveOutput = z.object({ url: z.url(), pid: z.number() });

// The packaged app runs this bundle with no workspace around it (P18.7).
let dir: string;
let db: EmptyDatabase;
let serve: ChildProcess | undefined;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentic-cli-bundle-"));
  await run(process.execPath, [bundleScript, join(dir, "cli")]);
  // Installed the way the app menu does it: a symlink somewhere on PATH.
  await symlink(join(dir, "cli", "agentic"), join(dir, "agentic"));
  db = await createEmptyDatabase();
}, 60_000);
afterAll(async () => {
  serve?.kill("SIGTERM");
  await db?.drop();
  await rm(dir, { recursive: true, force: true });
});

describe("bundled agentic CLI", () => {
  it("runs through a symlink without tsx", async () => {
    const { stdout } = await run(join(dir, "agentic"), ["--version"]);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("serves Core and applies the migrations shipped next to it", async () => {
    const child = spawn(join(dir, "agentic"), ["serve", "--json"], {
      env: {
        ...process.env,
        AGENTIC_DATABASE_URL: db.url,
        AGENTIC_DB_TLS: "disable",
        AGENTIC_DATA_DIR: join(dir, "data"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    serve = child;
    const { url } = serveOutput.parse(await readJson(child));
    expect((await fetch(`${url}/health`)).status).toBe(200);

    const shipped = (await readdir(join(dir, "cli", "migrations"))).filter((f) =>
      f.endsWith(".sql"),
    );
    const applied = await db.handle.pool.query(
      "select count(*)::int as n from drizzle.__drizzle_migrations",
    );
    expect(applied.rows[0]?.n).toBe(shipped.length);
  });
});

/** The first JSON value on stdout (`--json` prints it indented, over several lines). */
function readJson(child: ChildProcess): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!child.stdout) return reject(new Error("no stdout"));
    const lines = createInterface({ input: child.stdout });
    let text = "";
    lines.on("line", (line) => {
      text += line;
      try {
        resolve(JSON.parse(text));
        lines.close();
      } catch {
        // Not complete yet.
      }
    });
    child.once("exit", (code) => reject(new Error(`serve exited with ${code}`)));
  });
}
