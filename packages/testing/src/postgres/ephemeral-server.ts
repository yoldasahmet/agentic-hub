import { type ChildProcess, spawn } from "node:child_process";
import { chown, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findFreePort, resolveBinaries, waitUntilReady } from "@agentic/local-postgres";

export type EphemeralPostgres = { url: string; stop(): Promise<void> };

/** Postgres refuses to run as root; CI containers often are, so run it as `nobody`. */
const NOBODY = 65534;

/**
 * A throwaway cluster for one test run: the app's bundled binaries, a temp
 * dir, trust auth on loopback, and durability off (it is deleted anyway).
 */
export async function startEphemeralPostgres(): Promise<EphemeralPostgres> {
  const binaries = await resolveBinaries();
  const root = await mkdtemp(join(tmpdir(), "agentic-test-pg-"));
  const asRoot = process.getuid?.() === 0;
  const ids = asRoot ? { uid: NOBODY, gid: NOBODY } : {};
  if (asRoot) await chown(root, NOBODY, NOBODY);
  const dataDir = join(root, "data");
  const user = "agentic";

  await run(
    binaries.initdb,
    [
      `--pgdata=${dataDir}`,
      `--username=${user}`,
      "--auth=trust",
      "--encoding=UTF8",
      "--locale=C",
      "--no-sync",
    ],
    ids,
  );

  const port = await findFreePort();
  const server = spawn(
    binaries.postgres,
    // biome-ignore format: flag/value pairs read better on one line each
    [
      "-D", dataDir, "-p", String(port),
      "-c", "listen_addresses=127.0.0.1", "-c", "unix_socket_directories=",
      "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off",
      "-c", "max_connections=200",
    ],
    { stdio: ["ignore", "ignore", "pipe"], ...ids },
  );
  let exited: string | undefined;
  let stderr = "";
  server.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString("utf8")).slice(-4000);
  });
  server.once("exit", (code) => {
    exited = `exit ${code}\n${stderr}`;
  });

  const address = { host: "127.0.0.1", port, user, password: "", database: "postgres" };
  try {
    await waitUntilReady(address, () => exited);
  } catch (err) {
    await stopServer(server);
    await rm(root, { recursive: true, force: true });
    throw err;
  }
  return {
    url: `postgres://${user}@127.0.0.1:${port}/postgres`,
    async stop() {
      await stopServer(server);
      await rm(root, { recursive: true, force: true });
    },
  };
}

function run(file: string, args: string[], ids: { uid?: number; gid?: number }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ["ignore", "ignore", "pipe"], ...ids });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${file} exited with ${code}: ${stderr}`)),
    );
  });
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const done = new Promise<void>((resolve) => server.once("exit", () => resolve()));
  // Immediate shutdown: there is nothing to keep.
  server.kill("SIGQUIT");
  await done;
}
