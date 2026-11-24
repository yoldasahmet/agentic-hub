import { type ChildProcess, spawn } from "node:child_process";
import { chown, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type PostgresBinaries, resolveBinaries } from "./binaries";
import { findFreePort } from "./free-port";
import { ping, waitUntilReady } from "./health";
import { LOCAL_SUPERUSER } from "./local-postgres";
import { runBinary } from "./run-binary";
import { setClusterPassword } from "./snapshot";

// Postgres refuses root; containers often are root (see packages/testing).
const NOBODY = 65534;
const ids = process.getuid?.() === 0 ? { uid: NOBODY, gid: NOBODY } : {};

let root: string;
let dataDir: string;
let binaries: PostgresBinaries;
let server: ChildProcess | undefined;
beforeAll(async () => {
  binaries = await resolveBinaries();
  root = await mkdtemp(join(tmpdir(), "agentic-pg-password-"));
  if (ids.uid !== undefined) await chown(root, NOBODY, NOBODY);
  dataDir = join(root, "data");
  const pwfile = join(root, "pw");
  await writeFile(pwfile, "old-password\n");
  if (ids.uid !== undefined) await chown(pwfile, NOBODY, NOBODY);
  // biome-ignore format: flag/value pairs
  await runBinary(binaries.initdb, [
    `--pgdata=${dataDir}`, `--username=${LOCAL_SUPERUSER}`, `--pwfile=${pwfile}`,
    "--auth=scram-sha-256", "--locale=C", "--no-sync",
  ], ids);
}, 60_000);
afterAll(async () => {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server?.once("exit", resolve));
    server.kill("SIGQUIT");
    await exited;
  }
  await rm(root, { recursive: true, force: true });
});

describe("setClusterPassword", () => {
  it("sets the superuser password of a stopped cluster", async () => {
    await setClusterPassword(binaries.postgres, dataDir, LOCAL_SUPERUSER, "it's-new", ids);

    const port = await findFreePort();
    // biome-ignore format: flag/value pairs
    server = spawn(binaries.postgres, [
      "-D", dataDir, "-p", String(port),
      "-c", "listen_addresses=127.0.0.1", "-c", "unix_socket_directories=",
    ], { stdio: "ignore", ...ids });
    const address = {
      host: "127.0.0.1",
      port,
      user: LOCAL_SUPERUSER,
      password: "it's-new",
      database: "postgres",
    };
    await waitUntilReady(address, () => (server?.exitCode === null ? undefined : "exited"));
    await expect(ping({ ...address, password: "old-password" })).rejects.toThrow(/password/);
  });
});
