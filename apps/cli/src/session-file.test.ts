import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSessionFile, removeSessionFile, writeSessionFile } from "./session-file";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentic-cli-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const session = {
  token: `ags_${"a".repeat(43)}`,
  email: "me@example.com",
  expiresAt: "2026-11-11T00:00:00.000Z",
};

describe("CLI session file", () => {
  it("round-trips the session, readable by this user only", async () => {
    const path = await writeSessionFile(dir, session);
    expect(await readSessionFile(dir)).toEqual(session);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await stat(join(dir, "cli"))).mode & 0o777).toBe(0o700);
  });

  it("ignores a missing or tampered file", async () => {
    expect(await readSessionFile(dir)).toBeUndefined();
    await writeSessionFile(dir, session);
    await writeFile(join(dir, "cli", "session.json"), '{"token":"nope"}');
    expect(await readSessionFile(dir)).toBeUndefined();
  });

  it("removes the session on logout", async () => {
    await writeSessionFile(dir, session);
    expect(await removeSessionFile(dir)).toBe(true);
    expect(await readSessionFile(dir)).toBeUndefined();
    expect(await removeSessionFile(dir)).toBe(false);
  });
});
