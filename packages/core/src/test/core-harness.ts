import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AuthSession,
  authSessionSchema,
  type DbConnectionConfig,
  type DbMode,
  SESSION_HEADER,
} from "@agentic/contracts";
import { type FakeReply, fakeProvider, type TestDatabase } from "@agentic/testing";
import type { z } from "zod";
import { type CoreInstance, startCore } from "../core";

export type Api = <S extends z.ZodType>(
  schema: S,
  method: string,
  path: string,
  body?: unknown,
) => Promise<z.infer<S>>;

/** The test server as the bundled local service would be configured, or as a team DB. */
function connection(url: string, mode: DbMode): DbConnectionConfig {
  if (mode === "remote") return { mode, connectionString: url, tls: "disable" };
  const parsed = new URL(url);
  return {
    mode,
    host: parsed.hostname,
    port: Number(parsed.port),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
  };
}

type Options = { replies?: FakeReply[]; dbMode?: DbMode; signUp?: boolean };

/**
 * Full Core (HTTP, graph host, worker) on a test database, with a scripted
 * `fake` provider. The test DB counts as a team DB unless `dbMode` says
 * otherwise, so by default an owner account signs up and every request
 * carries its session; `signUp: false` leaves the test signed out.
 */
export async function startTestCore(
  db: TestDatabase,
  { replies = ["ok"], dbMode = "remote", signUp = dbMode === "remote" }: Options = {},
) {
  const dataDir = await mkdtemp(join(tmpdir(), "agentic-core-"));
  const provider = fakeProvider(replies);
  const core: CoreInstance = await startCore(
    { db: connection(db.url, dbMode), dataDir, secrets: {} },
    { version: "0.0.0-test", extraProviders: [provider] },
  );
  let session: AuthSession | undefined;
  const request = (
    method: string,
    path: string,
    body?: unknown,
    token = core.info.token,
    sessionToken = session?.token,
  ) =>
    fetch(`${core.info.url}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(sessionToken ? { [SESSION_HEADER]: sessionToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  /** Calls Core and parses the JSON answer with a contract schema; non-2xx throws its body. */
  const api: Api = async (schema, method, path, body) => {
    const res = await request(method, path, body);
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 500)}`);
    return schema.parse(JSON.parse(text));
  };
  if (signUp) {
    session = await api(authSessionSchema, "POST", "/auth/sign-up", {
      email: "owner@example.com",
      password: "correct horse battery",
      displayName: "Owner",
    });
  }
  return {
    core,
    session,
    provider,
    request,
    api,
    async stop() {
      await core.stop();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

export type TestCore = Awaited<ReturnType<typeof startTestCore>>;
