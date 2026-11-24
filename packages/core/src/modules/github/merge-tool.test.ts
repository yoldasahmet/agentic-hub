import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { GithubConnection, githubWriteTools } from "@agentic/integrations";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Seen = { method?: string; url?: string; body: unknown };
let seen: Seen = { body: undefined };
let server: Server;
let baseUrl = "";

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  let text = "";
  for await (const chunk of req) text += String(chunk);
  return text ? JSON.parse(text) : undefined;
}

// A stand-in for GitHub's REST API: answers the merge endpoint only.
beforeAll(async () => {
  server = createServer(async (req, res) => {
    seen = { method: req.method, url: req.url, body: await bodyOf(req) };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ merged: true, sha: "abc123", message: "Pull Request merged" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function mergeTool() {
  const conn = new GithubConnection({
    vaultToken: () => "test-token",
    ghToken: async () => undefined,
    baseUrl,
    userAgent: "agentic-test",
  });
  const tool = githubWriteTools(conn, "github.com").find(
    (t) => t.descriptor.name === "github.pr.merge",
  );
  if (!tool) throw new Error("github.pr.merge is not registered");
  return tool;
}

const ctx = {
  workspaceId: "w",
  cwd: tmpdir(),
  signal: new AbortController().signal,
  timeoutMs: 10_000,
  maxOutputBytes: 100_000,
  secrets: [],
};

describe("github.pr.merge", () => {
  it("is a write tool, so the approval policy asks first by default", () => {
    expect(mergeTool().descriptor.permission).toBe("write");
  });

  it("squash-merges the pull request at the checked head", async () => {
    const result = await mergeTool().run({ repo: "o/r", number: 7, sha: "abc123" }, ctx);
    expect(seen).toEqual({
      method: "PUT",
      url: "/repos/o/r/pulls/7/merge",
      body: { merge_method: "squash", sha: "abc123" },
    });
    expect(result).toEqual({ merged: true, sha: "abc123", message: "Pull Request merged" });
  });

  it("refuses input without a pull request number", async () => {
    await expect(mergeTool().run({ repo: "o/r" }, ctx)).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});
