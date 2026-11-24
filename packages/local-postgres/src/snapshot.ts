import { chmod, mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { AppError } from "@agentic/contracts";
import { type RunOptions, runBinary } from "./run-binary";

/**
 * Offline snapshots of the local cluster (P18.2). The bundled binaries have
 * no pg_dump, and a file copy of a running cluster isn't consistent, so the
 * caller stops the server first. A snapshot is a gzipped tar of the data dir.
 */
export async function backupCluster(dataDir: string, file: string): Promise<{ bytes: number }> {
  await clusterVersion(dataDir).catch(() => {
    throw new AppError("not_found", "There is no local database to back up yet.");
  });
  const partial = `${file}.partial`;
  await runBinary("tar", [
    "-czf",
    partial,
    "--exclude=postmaster.pid",
    "--exclude=postmaster.opts",
    "-C",
    dirname(dataDir),
    basename(dataDir),
  ]);
  await rename(partial, file);
  return { bytes: (await stat(file)).size };
}

export type RestoreOptions = {
  file: string;
  dataDir: string;
  /**
   * Sets the superuser password on the restored cluster, so a backup from
   * another machine (another vault password) still opens.
   */
  setPassword: (dataDir: string) => Promise<void>;
};

/**
 * Replaces the stopped cluster with a snapshot. The current cluster is kept
 * at `<dataDir>.before-restore` (replacing an older one) until the next
 * restore; returns that path for `rollbackRestore`.
 */
export async function restoreCluster(options: RestoreOptions): Promise<string> {
  const { file, dataDir, setPassword } = options;
  const staging = `${dataDir}.restoring`;
  const previous = `${dataDir}.before-restore`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true, mode: 0o700 });
  try {
    await runBinary("tar", ["-xzf", file, "-C", staging]);
    const restored = await findCluster(staging);
    const current = await clusterVersion(dataDir).catch(() => undefined);
    const version = await clusterVersion(restored);
    if (current && current !== version) {
      throw new AppError(
        "validation_failed",
        `The backup is from Postgres ${version}; this app runs Postgres ${current}.`,
      );
    }
    // Postgres refuses a data dir that others can read.
    await chmod(restored, 0o700);
    await setPassword(restored);
    await rm(previous, { recursive: true, force: true });
    if (current) await rename(dataDir, previous);
    await rename(restored, dataDir);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return previous;
}

/** Puts the cluster `restoreCluster` moved aside back in place. */
export async function rollbackRestore(dataDir: string, previous: string): Promise<void> {
  await rm(dataDir, { recursive: true, force: true });
  await rename(previous, dataDir);
}

/** Single-user mode reads the statement from stdin, so the password never reaches argv. */
export function setClusterPassword(
  postgres: string,
  dataDir: string,
  user: string,
  password: string,
  options: Omit<RunOptions, "input"> = {},
): Promise<void> {
  const ident = `"${user.replaceAll('"', '""')}"`;
  const literal = `'${password.replaceAll("'", "''")}'`;
  return runBinary(postgres, ["--single", "-D", dataDir, "postgres"], {
    ...options,
    input: `ALTER ROLE ${ident} PASSWORD ${literal};\n`,
  });
}

async function clusterVersion(dataDir: string): Promise<string> {
  return (await readFile(join(dataDir, "PG_VERSION"), "utf8")).trim();
}

/** The one top-level folder of the archive that holds a cluster. */
async function findCluster(staging: string): Promise<string> {
  for (const entry of await readdir(staging, { withFileTypes: true })) {
    const dir = join(staging, entry.name);
    if (entry.isDirectory() && (await clusterVersion(dir).catch(() => undefined))) return dir;
  }
  throw new AppError("validation_failed", "That file isn't an Agentic database backup.");
}
