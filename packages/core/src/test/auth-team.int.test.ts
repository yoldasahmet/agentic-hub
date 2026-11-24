import {
  appErrorSchema,
  authSessionSchema,
  authStatusSchema,
  workspaceMemberSchema,
} from "@agentic/contracts";
import { createTestDatabase, type TestDatabase } from "@agentic/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { startTestCore, type TestCore } from "./core-harness";

let db: TestDatabase;
let core: TestCore;
beforeAll(async () => {
  db = await createTestDatabase();
  core = await startTestCore(db);
});
afterAll(async () => {
  await core?.stop();
  await db?.drop();
});

const anon = (method: string, path: string, body?: unknown) =>
  core.request(method, path, body, core.core.info.token, "");
const as = (session: string, method: string, path: string, body?: unknown) =>
  core.request(method, path, body, core.core.info.token, session);
const code = async (res: Response) => appErrorSchema.parse(await res.json()).code;

async function signUp(email: string, displayName = "Member") {
  const res = await anon("POST", "/auth/sign-up", {
    email,
    password: "hunter2-hunter2",
    displayName,
  });
  expect(res.status).toBe(201);
  return authSessionSchema.parse(await res.json());
}

describe("auth on a team DB (P17)", () => {
  it("requires a session for everything but status, sign-up, and sign-in", async () => {
    const res = await anon("GET", "/agents");
    expect(res.status).toBe(401);
    expect(await code(res)).toBe("auth.required");
    const status = authStatusSchema.parse(await (await anon("GET", "/auth/status")).json());
    expect(status).toMatchObject({ dbMode: "remote", autoSignIn: false, user: null });
    expect(status.hasAccounts).toBe(true);
  });

  it("lets the first account claim the bootstrap owner", async () => {
    const owner = core.session;
    expect(owner?.role).toBe("owner");
    const { rows } = await db.handle.pool.query<{ created_by: string }>(
      "select created_by from workspaces",
    );
    expect(rows[0]?.created_by).toBe(owner?.user.id);
    const status = authStatusSchema.parse(await (await core.request("GET", "/auth/status")).json());
    expect(status).toMatchObject({ signedIn: true, role: "owner", user: { kind: "password" } });
  });

  it("stores only hashes of passwords and session tokens", async () => {
    const { rows } = await db.handle.pool.query<{ password_hash: string; token_hash: string }>(
      "select u.password_hash, s.token_hash from users u join auth_sessions s on s.user_id = u.id",
    );
    for (const row of rows) {
      expect(row.password_hash).toMatch(/^scrypt\$/);
      expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(row.token_hash).not.toBe(core.session?.token);
    }
  });

  it("adds later sign-ups as members and refuses a taken email", async () => {
    const member = await signUp("Second@Example.com");
    expect(member).toMatchObject({ role: "member", user: { email: "second@example.com" } });
    const again = await anon("POST", "/auth/sign-up", {
      email: "second@example.COM",
      password: "another-password",
      displayName: "Copy",
    });
    expect(again.status).toBe(409);
    const weak = await anon("POST", "/auth/sign-up", {
      email: "weak@example.com",
      password: "short",
      displayName: "Weak",
    });
    expect(weak.status).toBe(400);
  });

  it("answers a wrong password and an unknown email the same way", async () => {
    for (const email of ["owner@example.com", "nobody@example.com"]) {
      const res = await anon("POST", "/auth/sign-in", { email, password: "wrong-password" });
      expect(res.status).toBe(401);
      expect(await code(res)).toBe("auth.invalid_credentials");
    }
  });

  it("signs in, and signing out ends that session only", async () => {
    const res = await anon("POST", "/auth/sign-in", {
      email: "OWNER@example.com",
      password: "correct horse battery",
      client: "cli",
    });
    const session = authSessionSchema.parse(await res.json());
    expect((await as(session.token, "GET", "/agents")).status).toBe(200);
    expect((await as(session.token, "POST", "/auth/sign-out")).status).toBe(200);
    const after = await as(session.token, "GET", "/agents");
    expect(after.status).toBe(401);
    expect(await code(after)).toBe("auth.session_invalid");
    // A stale session never blocks getting a new one.
    const again = await as(session.token, "POST", "/auth/sign-in", {
      email: "owner@example.com",
      password: "correct horse battery",
    });
    expect(again.status).toBe(200);
    expect((await core.request("GET", "/agents")).status).toBe(200);
  });

  it("keeps member management to owners and always leaves an owner", async () => {
    const member = await signUp("third@example.com");
    const ownerId = core.session?.user.id ?? "";
    const denied = await as(member.token, "DELETE", `/auth/members/${ownerId}`);
    expect(denied.status).toBe(403);
    expect((await core.request("PUT", `/auth/members/${ownerId}`, { role: "member" })).status).toBe(
      400,
    );
    expect((await core.request("DELETE", `/auth/members/${ownerId}`)).status).toBe(400);
    const members = z
      .array(workspaceMemberSchema)
      .parse(await (await as(member.token, "GET", "/auth/members")).json());
    expect(members.map((m) => m.role)).toEqual(["owner", "member", "member"]);

    expect((await core.request("DELETE", `/auth/members/${member.user.id}`)).status).toBe(200);
    expect((await as(member.token, "GET", "/agents")).status).toBe(401);
  });

  it("never turns on auto sign-in for a team DB", async () => {
    const res = await core.request("PUT", "/auth/settings", { autoSignIn: true });
    expect(res.status).toBe(400);
  });

  it("slows down password guessing", async () => {
    const attempt = () =>
      anon("POST", "/auth/sign-in", { email: "guess@example.com", password: "nope" });
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(401);
    const locked = await attempt();
    expect(locked.status).toBe(429);
    expect(await code(locked)).toBe("auth.rate_limited");
  });
});
