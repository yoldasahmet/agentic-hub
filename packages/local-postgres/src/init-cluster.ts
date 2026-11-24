import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AppError } from "@agentic/contracts";
import { runBinary } from "./run-binary";

export type InitClusterOptions = {
  initdb: string;
  dataDir: string;
  user: string;
  password: string;
};

/** Creates the cluster on first launch. Returns false when it already exists. */
export async function initCluster(options: InitClusterOptions): Promise<boolean> {
  const { initdb, dataDir, user, password } = options;
  if (await exists(join(dataDir, "PG_VERSION"))) return false;
  if ((await readdir(dataDir).catch(() => [])).length > 0) {
    throw new AppError(
      "conflict",
      `${dataDir} is not empty and is not a Postgres cluster. Move it aside to start fresh.`,
    );
  }

  const parent = dirname(dataDir);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  // initdb reads the superuser password from a file so it never shows in `ps`.
  const pwfile = join(parent, `.pwfile-${process.pid}`);
  await writeFile(pwfile, `${password}\n`, { mode: 0o600 });
  try {
    await runBinary(initdb, [
      `--pgdata=${dataDir}`,
      `--username=${user}`,
      `--pwfile=${pwfile}`,
      "--auth=scram-sha-256",
      "--encoding=UTF8",
      // The C locale makes the cluster independent of the user's OS locale.
      "--locale=C",
    ]);
  } finally {
    await rm(pwfile, { force: true });
  }
  return true;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
