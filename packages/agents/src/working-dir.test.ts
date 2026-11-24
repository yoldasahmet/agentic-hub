import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderRegistry } from "@agentic/llm";
import { McpPool, Toolbox, ToolRegistry } from "@agentic/tools";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AgentRuntimeDeps } from "./deps";
import { resolveWorkingDir } from "./working-dir";

let root: string;
let deps: AgentRuntimeDeps;
const config = { configurable: { workspace_id: "w" } };

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "agentic-agent-dir-")));
  for (const dir of ["scratch", "allowed", "outside"]) await mkdir(join(root, dir));
  const scratchDir = join(root, "scratch");
  deps = {
    providers: new ProviderRegistry(),
    pricing: async () => undefined,
    scratchDir,
    tools: new Toolbox({
      registry: new ToolRegistry(),
      pool: new McpPool("0.0.0-test"),
      scratchDir,
      mcpServers: async () => [],
      skills: async () => [],
      guardrails: async () => ({
        allowedDirs: [join(root, "allowed")],
        timeoutMs: 60_000,
        maxOutputBytes: 64_000,
      }),
      secretValues: () => [],
    }),
  };
});
afterAll(() => rm(root, { recursive: true, force: true }));

describe("resolveWorkingDir", () => {
  it("uses scratch for the scratch policy", async () => {
    await expect(resolveWorkingDir({ mode: "scratch" }, {}, deps, config)).resolves.toBe(
      deps.scratchDir,
    );
  });

  it("allows a fixed or input path inside an allowed folder", async () => {
    const path = join(root, "allowed");
    await expect(resolveWorkingDir({ mode: "fixed", path }, {}, deps, config)).resolves.toBe(path);
    await expect(
      resolveWorkingDir({ mode: "input", field: "dir" }, { dir: path }, deps, config),
    ).resolves.toBe(path);
  });

  it("refuses a path from an input that is outside the allowed folders", async () => {
    const outside = join(root, "outside");
    await expect(
      resolveWorkingDir({ mode: "input", field: "dir" }, { dir: outside }, deps, config),
    ).rejects.toMatchObject({ code: "tool.dir_denied" });
  });

  it("refuses relative paths", async () => {
    await expect(
      resolveWorkingDir({ mode: "fixed", path: "repo" }, {}, deps, config),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});
