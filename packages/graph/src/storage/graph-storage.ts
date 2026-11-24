import type { BaseStore } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";
import type pg from "pg";
import { withAdvisoryLock } from "../lib/advisory-lock";

/** LangGraph's own tables live in their own schema, apart from the Drizzle tables. */
export const GRAPH_SCHEMA = "langgraph";
/** Arbitrary key ("lgsu"): one instance at a time runs the saver/store setup. */
const SETUP_LOCK_KEY = 0x6c677375;

export type GraphStorage = {
  checkpointer: PostgresSaver;
  store: BaseStore;
  close(): Promise<void>;
};

/**
 * The official `PostgresSaver` + `PostgresStore` on the active DB (D4).
 * The saver shares the app pool; the store opens its own small pool
 * because it only accepts connection options.
 */
export async function openGraphStorage(
  pool: pg.Pool,
  connection: pg.PoolConfig,
): Promise<GraphStorage> {
  const checkpointer = new PostgresSaver(pool, undefined, { schema: GRAPH_SCHEMA });
  const store = new PostgresStore({
    connectionOptions: { ...connection, max: 4 },
    schema: GRAPH_SCHEMA,
    ensureTables: false,
  });
  // Neither setup() takes a lock, so concurrent first runs on a team DB would race.
  await withAdvisoryLock(pool, SETUP_LOCK_KEY, async () => {
    await pool.query(`create schema if not exists "${GRAPH_SCHEMA}"`);
    await checkpointer.setup();
    await store.setup();
  });
  return { checkpointer, store, close: () => store.stop() };
}
