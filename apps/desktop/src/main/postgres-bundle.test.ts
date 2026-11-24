import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { expect, test } from "vitest";
import config from "../../electron.vite.config";

const dbRequire = createRequire(new URL("../../../../packages/db/package.json", import.meta.url));

test.each(["development", "production"])(
  "the %s main bundle loads PostgreSQL without its optional native driver",
  async (mode) => {
    const root = await mkdtemp(join(tmpdir(), "agentic-pg-bundle-"));
    try {
      const entry = join(root, "entry.js");
      await writeFile(
        entry,
        `import { Pool } from ${JSON.stringify(dbRequire.resolve("pg"))}; export const pool = new Pool();`,
      );
      await build({
        configFile: false,
        root,
        mode,
        logLevel: "silent",
        ssr: { noExternal: true },
        build: {
          ssr: entry,
          commonjsOptions: config.main?.build?.commonjsOptions,
          outDir: join(root, "out"),
          rollupOptions: { output: { entryFileNames: "postgres.mjs" } },
        },
      });
      // A separate Node process exercises the emitted bundle, rather than
      // letting Vitest resolve the original, unbundled dependency.
      const bundle = pathToFileURL(join(root, "out", "postgres.mjs")).href;
      const output = execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `const { pool } = await import(${JSON.stringify(bundle)}); process.stdout.write(typeof pool.query); await pool.end();`,
        ],
        { encoding: "utf8" },
      );
      expect(output).toBe("function");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  30_000,
);
