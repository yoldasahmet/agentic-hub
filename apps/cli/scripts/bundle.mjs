// Bundles the CLI into dist/ for the packaged app (P18.7), which copies it to
// Contents/Resources/cli. No tsx: `agentic` is a small CommonJS launcher that
// checks Node and imports `agentic.mjs`, one ESM file holding every workspace
// package. The SQL migrations sit next to it for `agentic serve`.
import { chmod, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
// An optional argument writes elsewhere (the bundle integration test).
const dist = process.argv[2] ? resolve(process.argv[2]) : `${root}dist`;

// Optional or native modules that are loaded lazily and may be missing:
// node-pty (PTY sessions, built for Electron in the app) and pg-native.
const external = ["node-pty", "pg-native"];

// CommonJS dependencies inside an ESM bundle still call require().
const banner = [
  'import { createRequire as __agenticRequire } from "node:module";',
  "const require = __agenticRequire(import.meta.url);",
].join("\n");

const launcher = `#!/usr/bin/env node
// agentic: the command line for Agentic Hub. Needs Node 22 or later.
"use strict";
const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  process.stderr.write("agentic needs Node.js 22 or later (found " + process.version + "). Install it from https://nodejs.org or with Homebrew (brew install node).\\n");
  process.exit(1);
}
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
import(pathToFileURL(join(__dirname, "agentic.mjs")).href);
`;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await build({
  entryPoints: [`${root}src/main.ts`],
  outfile: `${dist}/agentic.mjs`,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external,
  banner: { js: banner },
  legalComments: "none",
  logLevel: "warning",
});
await writeFile(`${dist}/agentic`, launcher);
await chmod(`${dist}/agentic`, 0o755);
// The launcher has no extension: pin it to CommonJS whatever package.json sits above it.
await writeFile(`${dist}/package.json`, `${JSON.stringify({ type: "commonjs" })}\n`);
await cp(`${root}../../packages/db/drizzle`, `${dist}/migrations`, { recursive: true });
