import { appErrorSchema, authSessionSchema, authStatusSchema } from "@agentic/contracts";
import { createTestDatabase, type TestDatabase } from "@agentic/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestCore, type TestCore } from "./core-harness";

let db: TestDatabase;
let core: TestCore;
beforeAll(async () => {
  db = await createTestDatabase();
  core = await startTestCore(db, { dbMode: "local" });
});
afterAll(async () => {
  await core?.stop();
  await db?.drop();
});

const status = async (session?: string) =>
  authStatusSchema.parse(
    await (await core.request("GET", "/auth/status", undefined, undefined, session)).json(),
  );

describe("auth on the local DB (P17.3)", () => {
  it("auto signs in as the local owner without a session", async () => {
    expect((await core.request("GET", "/agents")).status).toBe(200);
    expect(await status()).toMatchObject({
      dbMode: "local",
      autoSignInAvailable: true,
      autoSignIn: true,
      hasAccounts: false,
      signedIn: false,
      role: "owner",
      user: { kind: "local" },
    });
  });

  it("won't turn auto sign-in off before an account exists", async () => {
    const res = await core.request("PUT", "/auth/settings", { autoSignIn: false });
    expect(res.status).toBe(400);
  });

  it("requires a sign-in once the owner turns auto sign-in off", async () => {
    const localId = (await status()).user?.id;
    const res = await core.request("POST", "/auth/sign-up", {
      email: "me@example.com",
      password: "correct horse battery",
      displayName: "Me",
    });
    const session = authSessionSchema.parse(await res.json());
    expect(session).toMatchObject({ role: "owner", user: { id: localId, kind: "password" } });

    const off = await core.request("PUT", "/auth/settings", { autoSignIn: false });
    expect(off.status).toBe(200);
    const signedOut = await core.request("GET", "/agents");
    expect(signedOut.status).toBe(401);
    expect(appErrorSchema.parse(await signedOut.json()).code).toBe("auth.required");
    expect(await status()).toMatchObject({ autoSignIn: false, user: null });

    const ok = await core.request("GET", "/agents", undefined, undefined, session.token);
    expect(ok.status).toBe(200);
    const on = await core.request(
      "PUT",
      "/auth/settings",
      { autoSignIn: true },
      undefined,
      session.token,
    );
    expect(on.status).toBe(200);
    expect((await core.request("GET", "/agents")).status).toBe(200);
  });
});
