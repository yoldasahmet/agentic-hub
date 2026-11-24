import { hostname } from "node:os";
import { poolConfig } from "@agentic/db";
import type { TestDatabase } from "@agentic/testing";
import { AssistantRegistry } from "../assistants/registry";
import { sampleAssistant } from "../assistants/sample-assistant";
import { createGraphRuntime } from "../runtime";

/** A graph runtime on a test database with the sample assistant, polling fast. */
export async function testRuntime(db: TestDatabase, options: { leaseMs?: number } = {}) {
  const registry = new AssistantRegistry();
  registry.register(sampleAssistant);
  const runtime = await createGraphRuntime({
    handle: db.handle,
    connection: poolConfig({ mode: "remote", connectionString: db.url, tls: "disable" }),
    registry,
    host: hostname(),
    pollMs: 50,
    leaseMs: options.leaseMs,
  });
  await runtime.start();
  return runtime;
}
