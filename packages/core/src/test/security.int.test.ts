import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appErrorSchema, chatSchema, SESSION_HEADER } from "@agentic/contracts";
import { createTestDatabase, type TestDatabase } from "@agentic/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { startTestCore, type TestCore } from "./core-harness";

let db: TestDatabase;
let core: TestCore;
let outside: string;
beforeAll(async () => {
  db = await createTestDatabase();
  core = await startTestCore(db);
  outside = await mkdtemp(join(tmpdir(), "agentic-outside-"));
});
afterAll(async () => {
  await core?.stop();
  await db?.drop();
  if (outside) await rm(outside, { recursive: true, force: true });
});

/** Opens a socket and resolves with the upgrade's HTTP status (101 on success). */
function upgradeStatus(token: string, origin?: string, session = core.session?.token) {
  const query = new URLSearchParams({ token, ...(session ? { session } : {}) });
  const url = `${core.core.info.url.replace("http", "ws")}/ws?${query}`;
  return new Promise<number>((resolve) => {
    const ws = new WebSocket(url, origin ? { origin } : {});
    ws.once("open", () => {
      ws.close();
      resolve(101);
    });
    ws.once("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
    ws.once("error", () => resolve(0));
  });
}

describe("Core security boundary (P15)", () => {
  it("refuses web pages from other origins, even with the token", async () => {
    const res = await fetch(`${core.core.info.url}/agents`, {
      headers: { authorization: `Bearer ${core.core.info.token}`, origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers CORS for the renderer's origins", async () => {
    for (const origin of ["file://", "null", "http://localhost:5173"]) {
      const res = await fetch(`${core.core.info.url}/agents`, {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "GET",
          "access-control-request-headers": `authorization, ${SESSION_HEADER}`,
        },
      });
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("access-control-allow-headers")).toContain(SESSION_HEADER);
    }
  });

  it("refuses a spoofed Host header (DNS rebinding)", async () => {
    const { request } = await import("node:http");
    const url = new URL(core.core.info.url);
    const status = await new Promise<number>((resolve) => {
      const req = request(
        { host: url.hostname, port: url.port, path: "/health", headers: { host: "evil.example" } },
        (res) => resolve(res.statusCode ?? 0),
      );
      req.end();
    });
    expect(status).toBe(403);
  });

  it("checks token, origin, and session on WebSocket upgrades", async () => {
    const token = core.core.info.token;
    expect(await upgradeStatus(token)).toBe(101);
    expect(await upgradeStatus("x".repeat(64))).toBe(401);
    expect(await upgradeStatus(token, "https://evil.example")).toBe(403);
    expect(await upgradeStatus(token, undefined, "")).toBe(401);
    expect(await upgradeStatus(token, undefined, `ags_${"x".repeat(43)}`)).toBe(401);
  });

  it("keeps a chat's working dir inside the allowed folders", async () => {
    const res = await core.request("POST", "/chats", {
      target: { kind: "app" },
      workingDir: outside,
    });
    expect(res.status).toBe(403);
    expect(appErrorSchema.parse(await res.json()).code).toBe("tool.dir_denied");

    await core.request("PUT", "/tools/guardrails", { allowedDirs: [outside] });
    const chat = await core.api(chatSchema, "POST", "/chats", {
      target: { kind: "app" },
      workingDir: outside,
    });
    expect(chat.workingDir).toBe(outside);
  });
});
