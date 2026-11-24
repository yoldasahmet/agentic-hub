import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runBinary } from "./run-binary";
import { backupCluster, restoreCluster, rollbackRestore } from "./snapshot";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "agentic-snapshot-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A stand-in cluster: what the snapshot code looks at is PG_VERSION and the files. */
async function fakeCluster(dir: string, marker: string, version = "18"): Promise<void> {
  await mkdir(join(dir, "base"), { recursive: true });
  await writeFile(join(dir, "PG_VERSION"), `${version}\n`);
  await writeFile(join(dir, "base", "marker"), marker);
  await writeFile(join(dir, "postmaster.pid"), "123");
}

const marker = (dir: string) => readFile(join(dir, "base", "marker"), "utf8");
const noPassword = async () => {};

describe("cluster snapshots", () => {
  it("backs up and restores a cluster, keeping the replaced one aside", async () => {
    const dataDir = join(root, "data");
    const file = join(root, "backup.tar.gz");
    await fakeCluster(dataDir, "backed up");
    expect((await backupCluster(dataDir, file)).bytes).toBeGreaterThan(0);

    await rm(dataDir, { recursive: true });
    await fakeCluster(dataDir, "newer");
    const passwordSetOn: string[] = [];
    const previous = await restoreCluster({
      file,
      dataDir,
      setPassword: async (dir) => {
        passwordSetOn.push(await marker(dir));
      },
    });

    expect(await marker(dataDir)).toBe("backed up");
    expect(await marker(previous)).toBe("newer");
    expect(passwordSetOn).toEqual(["backed up"]);
    // A stale pid file would make Postgres think the server is still running.
    await expect(stat(join(dataDir, "postmaster.pid"))).rejects.toThrow();
    expect((await stat(dataDir)).mode & 0o777).toBe(0o700);

    await rollbackRestore(dataDir, previous);
    expect(await marker(dataDir)).toBe("newer");
  });

  it("refuses a backup from another Postgres major version", async () => {
    const dataDir = join(root, "data");
    const file = join(root, "old.tar.gz");
    await fakeCluster(join(root, "old", "data"), "old", "17");
    await backupCluster(join(root, "old", "data"), file);
    await fakeCluster(dataDir, "current");

    await expect(restoreCluster({ file, dataDir, setPassword: noPassword })).rejects.toThrow(
      /Postgres 17; this app runs Postgres 18/,
    );
    expect(await marker(dataDir)).toBe("current");
  });

  it("refuses an archive without a cluster", async () => {
    const dataDir = join(root, "data");
    const file = join(root, "other.tar.gz");
    await mkdir(join(root, "other", "photos"), { recursive: true });
    await runBinary("tar", ["-czf", file, "-C", join(root, "other"), "photos"]);
    await fakeCluster(dataDir, "current");

    await expect(restoreCluster({ file, dataDir, setPassword: noPassword })).rejects.toThrow(
      /isn't an Agentic database backup/,
    );
    expect(await marker(dataDir)).toBe("current");
  });

  it("restores into a fresh install with no cluster yet", async () => {
    const file = join(root, "backup.tar.gz");
    await fakeCluster(join(root, "src", "data"), "moved");
    await backupCluster(join(root, "src", "data"), file);

    const dataDir = join(root, "fresh", "data");
    await mkdir(join(root, "fresh"));
    await restoreCluster({ file, dataDir, setPassword: noPassword });
    expect(await marker(dataDir)).toBe("moved");
  });

  it("says when there is nothing to back up", async () => {
    await expect(backupCluster(join(root, "missing"), join(root, "b.tar.gz"))).rejects.toThrow(
      /no local database/,
    );
  });
});
