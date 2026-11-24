import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildChildEnv } from "./child-env";
import { validateWorkingDir } from "./working-dir";

describe("buildChildEnv", () => {
  const source = {
    HOME: "/Users/me",
    PATH: "/usr/bin",
    LANG: "en_US.UTF-8",
    ANTHROPIC_API_KEY: "sk-ant",
    OPENAI_API_KEY: "sk-oa",
    AGENTIC_SECRET_GITHUB_TOKEN: "ghp",
    AGENTIC_TOKEN: "core",
    ELECTRON_RUN_AS_NODE: "1",
  };

  it("passes only base keys and the CLI's own prefixes", () => {
    const env = buildChildEnv(source, { passPrefixes: ["ANTHROPIC_", "AGENTIC_"] });
    expect(env).toEqual({
      HOME: "/Users/me",
      PATH: "/usr/bin",
      LANG: "en_US.UTF-8",
      ANTHROPIC_API_KEY: "sk-ant",
      NO_COLOR: "1",
      CI: "1",
    });
  });

  it("uses the given PATH and lets explicit extras win", () => {
    const env = buildChildEnv(source, { path: "/opt/bin", extra: { HOME: "/tmp/h", X: "1" } });
    expect(env).toMatchObject({ PATH: "/opt/bin", HOME: "/tmp/h", X: "1" });
  });
});

describe("validateWorkingDir", () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "agentic-cwd-"));
    await writeFile(join(root, "file.txt"), "x");
    await symlink(root, join(root, "link"));
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it("resolves symlinks to the real directory", async () => {
    const real = await validateWorkingDir(root);
    expect(await validateWorkingDir(join(root, "link"))).toBe(real);
  });

  it("rejects relative, missing, non-directory, and NUL paths", async () => {
    for (const bad of [
      "relative/dir",
      join(root, "missing"),
      join(root, "file.txt"),
      `${root}\0x`,
    ]) {
      await expect(validateWorkingDir(bad)).rejects.toMatchObject({ code: "cli.cwd_invalid" });
    }
  });
});
