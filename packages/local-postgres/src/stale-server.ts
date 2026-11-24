import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * If the app crashed, its Postgres may still hold the data dir. Postgres
 * refuses to start next to it, so stop that orphan first. The process name
 * is checked so a reused pid never hits an unrelated process.
 */
export async function stopStaleServer(dataDir: string, timeoutMs = 15_000): Promise<void> {
  const pid = await readPostmasterPid(dataDir);
  if (pid === undefined || !isAlive(pid) || !(await isPostgres(pid))) return;

  process.kill(pid, "SIGINT"); // fast shutdown: rolls back open transactions
  const deadline = Date.now() + timeoutMs;
  while (isAlive(pid)) {
    if (Date.now() > deadline) {
      process.kill(pid, "SIGQUIT");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function readPostmasterPid(dataDir: string): Promise<number | undefined> {
  try {
    const first = (await readFile(join(dataDir, "postmaster.pid"), "utf8")).split("\n")[0];
    const pid = Number(first);
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isPostgres(pid: number): Promise<boolean> {
  try {
    const { stdout } = await run("ps", ["-p", String(pid), "-o", "comm="]);
    return stdout.trim().endsWith("postgres");
  } catch {
    return false;
  }
}
