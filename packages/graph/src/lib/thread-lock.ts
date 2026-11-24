import { sql } from "drizzle-orm";
import type { Tx } from "./executor";

/** Serializes run creation and state edits per thread, across app instances. */
export async function lockThread(tx: Tx, threadId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`thread:${threadId}`}))`);
}
