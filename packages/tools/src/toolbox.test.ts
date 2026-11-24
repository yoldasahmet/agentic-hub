import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpPool } from "./mcp/pool";
import { ToolRegistry } from "./registry";
import { Toolbox } from "./toolbox";

let root: string;
let toolbox: Toolbox;
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "agentic-toolbox-")));
  for (const dir of ["scratch", "allowed/repo", "managed", "outside"]) {
    await mkdir(join(root, dir), { recursive: true });
  }
  await symlink(join(root, "outside"), join(root, "allowed", "escape"));
  toolbox = new Toolbox({
    registry: new ToolRegistry(),
    pool: new McpPool("0.0.0-test"),
    scratchDir: join(root, "scratch"),
    managedDirs: [join(root, "managed")],
    mcpServers: async () => [],
    skills: async () => [],
    guardrails: async () => ({
      allowedDirs: [join(root, "allowed")],
      timeoutMs: 60_000,
      maxOutputBytes: 64_000,
    }),
    secretValues: () => [],
  });
});
afterAll(() => rm(root, { recursive: true, force: true }));

describe("Toolbox.checkDir", () => {
  it("accepts scratch, managed, and allowed folders and their children", async () => {
    for (const dir of ["scratch", "managed", "allowed", "allowed/repo"]) {
      await expect(toolbox.checkDir("w", join(root, dir))).resolves.toBe(join(root, dir));
    }
  });

  it("refuses other folders, relative paths, and symlinks that leave an allowed folder", async () => {
    for (const dir of [join(root, "outside"), join(root, "allowed", "escape"), "relative/dir"]) {
      await expect(toolbox.checkDir("w", dir)).rejects.toMatchObject({ code: "tool.dir_denied" });
    }
  });
});
