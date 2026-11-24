// Smoke check of a packaged app (P18.1, P18.2, P18.7) without launching it:
//   node scripts/check-package.mjs "release/mac-arm64/Agentic Hub.app"
//   node scripts/check-package.mjs release/linux-unpacked
// Checks the archive contents, the fuses, the bundled Postgres, and the CLI.
import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { listPackage } from "@electron/asar";
import fuses from "@electron/fuses";

const app = resolve(process.argv[2] ?? "");
const isMac = app.endsWith(".app");
const resources = isMac ? join(app, "Contents", "Resources") : join(app, "resources");
const executable = isMac ? join(app, "Contents", "MacOS", "Agentic Hub") : join(app, "agentic-hub");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failures.push(message);
};
const executableFile = (path) => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

// Local packages omit the feed. Release CI checks the destination baked into its bundle.
const expectedRepo = process.argv[3];
const feedFile = join(resources, "app-update.yml");
if (expectedRepo && existsSync(feedFile)) {
  const feed = readFileSync(feedFile, "utf8");
  const value = (key) =>
    feed
      .match(new RegExp(`^${key}:\\s+(.+)$`, "m"))?.[1]
      .trim()
      .replace(/^['"]|['"]$/g, "");
  check(
    value("provider") === "github" && `${value("owner")}/${value("repo")}` === expectedRepo,
    `update feed targets ${expectedRepo}`,
  );
} else {
  check(!expectedRepo && !existsSync(feedFile), "update feed is absent in a local build");
}
check(existsSync(join(resources, "LICENSE-agentic.txt")), "ships the project license");

// The archive: the electron-vite output and only the runtime dependencies.
const files = listPackage(join(resources, "app.asar"), { isPack: false });
for (const entry of [
  "/out/main/index.js",
  "/out/main/core.js",
  "/out/preload/index.cjs",
  "/out/renderer/index.html",
]) {
  check(files.includes(entry), `app.asar has ${entry}`);
}
check(
  files.some((f) => f.startsWith("/out/main/migrations/") && f.endsWith(".sql")),
  "app.asar has the SQL migrations",
);
const modules = new Set(
  files
    .map((f) => f.split("/"))
    .filter((parts) => parts[1] === "node_modules")
    .map((parts) => (parts[2]?.startsWith("@") ? `${parts[2]}/${parts[3]}` : parts[2])),
);
for (const dep of Object.keys(pkg.dependencies)) check(modules.has(dep), `ships ${dep}`);
const devOnly = ["electron", "react", "vite", "@agentic/core", "typescript"].filter((d) =>
  modules.has(d),
);
check(devOnly.length === 0, `no dev packages in app.asar ${devOnly.join(", ")}`);
const pty = join(resources, "app.asar.unpacked", "node_modules", "node-pty");
const ptyNative = isMac
  ? join(pty, "prebuilds", `darwin-${process.arch}`, "pty.node")
  : join(pty, "build", "Release", "pty.node");
check(existsSync(ptyNative), "node-pty's native addon is unpacked");

// Fuses (docs/security.md). The wire stores each state as a char code: "0" off, "1" on.
const { FuseV1Options, getCurrentFuseWire } = fuses;
const FuseState = { DISABLE: "0".charCodeAt(0), ENABLE: "1".charCodeAt(0) };
const wire = await getCurrentFuseWire(executable);
const fuse = (option, state, label) => check(wire[option] === state, `fuse ${label}`);
fuse(FuseV1Options.RunAsNode, FuseState.DISABLE, "RunAsNode off");
fuse(FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE, "NODE_OPTIONS off");
fuse(FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE, "--inspect off");
fuse(FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE, "ASAR integrity on");
fuse(FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE, "only load app.asar");
fuse(FuseV1Options.EnableCookieEncryption, FuseState.ENABLE, "cookie encryption on");

// Postgres (P18.2): the binaries start on this machine's arch.
const pgBin = join(resources, "postgres", "bin");
for (const tool of ["initdb", "pg_ctl", "postgres"]) {
  check(executableFile(join(pgBin, tool)), `postgres/bin/${tool} is executable`);
}
const pgVersion = execFileSync(join(pgBin, "postgres"), ["--version"], { encoding: "utf8" }).trim();
check(/PostgreSQL\)? \d+/.test(pgVersion), `bundled ${pgVersion}`);

// The CLI (P18.7) runs on the user's Node, without tsx.
const cli = join(resources, "cli", "agentic");
check(executableFile(cli), "cli/agentic is executable");
check(
  existsSync(join(resources, "cli", "migrations", "meta", "_journal.json")),
  "cli has its migrations",
);
const cliVersion = execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" }).trim();
check(cliVersion === pkg.version, `agentic --version is ${pkg.version} (got ${cliVersion})`);

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
