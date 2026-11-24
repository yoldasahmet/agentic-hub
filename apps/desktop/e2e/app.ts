import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coreRuntimeInfoSchema } from "@agentic/contracts";
import { type ElectronApplication, _electron as electron, type Page } from "@playwright/test";
import type { z } from "zod";

const MAIN = join(import.meta.dirname, "..", "out", "main", "index.js");

export type LaunchedApp = {
  app: ElectronApplication;
  page: Page;
  /** Calls the app's own Core with its per-launch token (setup without clicking through forms). */
  api<S extends z.ZodType>(
    schema: S,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<z.infer<S>>;
  close(): Promise<void>;
};

/** Starts the built app on a fresh profile and waits until Core is up. */
export async function launchApp(): Promise<LaunchedApp> {
  const userData = await mkdtemp(join(tmpdir(), "agentic-e2e-"));
  const app = await electron.launch({
    args: [MAIN],
    env: { ...process.env, AGENTIC_USER_DATA_DIR: userData, AGENTIC_LOG_LEVEL: "debug" },
  });
  const page = await app.firstWindow();
  const core = await waitForCore(join(userData, "runtime", "core.json"));
  const api: LaunchedApp["api"] = async (schema, method, path, body) => {
    const res = await fetch(`${core.url}${path}`, {
      method,
      headers: { authorization: `Bearer ${core.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
    return schema.parse(JSON.parse(text));
  };
  return {
    app,
    page,
    api,
    async close() {
      await app.close();
      await rm(userData, { recursive: true, force: true });
    },
  };
}

async function waitForCore(file: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const info = coreRuntimeInfoSchema.parse(JSON.parse(await readFile(file, "utf8")));
      const health = await fetch(`${info.url}/health`);
      if (health.ok) return info;
    } catch {
      // Not written yet, or Core still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Core did not start (no ${file})`);
}
