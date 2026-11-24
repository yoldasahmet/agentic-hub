import type { Database } from "@agentic/db";

/** A transaction handle, so store methods can join a caller's transaction. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Tx;
