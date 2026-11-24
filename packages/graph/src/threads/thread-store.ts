import {
  AppError,
  type CheckpointRef,
  type Thread,
  type ThreadListQuery,
  type ThreadStatus,
  threadSchema,
} from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, desc, eq } from "drizzle-orm";
import { iso } from "../lib/dates";
import type { Executor } from "../lib/executor";

const { threads } = schema;
type ThreadRow = typeof threads.$inferSelect;
type NewThread = { assistantId: string; assistantVersion: number; forkedFrom?: CheckpointRef };

/** Drizzle queries for the `threads` index. Every read is scoped by workspace. */
export class ThreadStore {
  constructor(private readonly db: Database) {}

  async insert(ctx: LocalContext, input: NewThread, db: Executor = this.db): Promise<Thread> {
    const [row] = await db
      .insert(threads)
      .values({
        workspaceId: ctx.workspaceId,
        createdBy: ctx.userId,
        assistantId: input.assistantId,
        assistantVersion: input.assistantVersion,
        forkedFrom: input.forkedFrom ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create the thread");
    return toThread(row);
  }

  async get(ctx: LocalContext, id: string, db: Executor = this.db): Promise<Thread> {
    const [row] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.workspaceId, ctx.workspaceId), eq(threads.id, id)))
      .limit(1);
    if (!row) throw new AppError("not_found", `Thread ${id} not found`);
    return toThread(row);
  }

  async list(ctx: LocalContext, query: ThreadListQuery): Promise<Thread[]> {
    const rows = await this.db
      .select()
      .from(threads)
      .where(
        and(
          eq(threads.workspaceId, ctx.workspaceId),
          query.status ? eq(threads.status, query.status) : undefined,
        ),
      )
      .orderBy(desc(threads.updatedAt))
      .limit(query.limit);
    return rows.map(toThread);
  }

  async setStatus(id: string, status: ThreadStatus): Promise<void> {
    await this.db.update(threads).set({ status }).where(eq(threads.id, id));
  }
}

function toThread(row: ThreadRow): Thread {
  return threadSchema.parse({
    id: row.id,
    assistantId: row.assistantId,
    assistantVersion: row.assistantVersion,
    status: row.status,
    metadata: row.metadata,
    forkedFrom: row.forkedFrom ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}
