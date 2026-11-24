import type { TestProject } from "vitest/node";
import { startEphemeralPostgres } from "./ephemeral-server";
import "./test-database";

/**
 * Vitest global setup for integration tests: one ephemeral Postgres per
 * run, or `AGENTIC_TEST_DATABASE_URL` (a server you run yourself, e.g. a
 * team DB's staging instance) when it is set.
 */
export async function setup(project: TestProject) {
  const external = process.env.AGENTIC_TEST_DATABASE_URL;
  if (external) {
    project.provide("databaseUrl", external);
    return;
  }
  const server = await startEphemeralPostgres();
  project.provide("databaseUrl", server.url);
  return () => server.stop();
}
