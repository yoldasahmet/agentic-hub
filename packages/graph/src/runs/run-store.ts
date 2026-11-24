import {
  AppError,
  type AppErrorShape,
  type Run,
  type RunListQuery,
  type RunStatus,
  runSchema,
} from "@agentic/contracts";
import { type Database, type LocalContext, schema } from "@agentic/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { iso, isoOrNull } from "../lib/dates";
import type { Executor } from "../lib/executor";

const { runs } = schema;
export type RunRow = typeof runs.$inferSelect;
type NewRun = { threadId: string; assistantId: string; assistantVersion: number; input: unknown };
export type RunPatch = {
  status: RunStatus;
  output?: unknown;
  error?: AppErrorShape | null;
  startedAt?: Date;
  finishedAt?: Date | null;
};

/** Runs that still own their thread: no other run may start on it. */
export const ACTIVE_RUN_STATUSES: RunStatus[] = ["queued", "running", "waiting"];

/** Drizzle queries for `runs`. User-facing reads are scoped by workspace. */
export class RunStore {
  constructor(private readonly db: Database) {}

  async insert(ctx: LocalContext, input: NewRun, db: Executor = this.db): Promise<RunRow> {
    const [row] = await db
      .insert(runs)
      .values({
        workspaceId: ctx.workspaceId,
        createdBy: ctx.userId,
        kind: "graph",
        assistantId: input.assistantId,
        targetVersion: input.assistantVersion,
        threadId: input.threadId,
        status: "queued",
        input: input.input,
      })
      .returning();
    if (!row) throw new Error("Failed to create the run");
    return row;
  }

  async get(ctx: LocalContext, id: string, db: Executor = this.db): Promise<RunRow> {
    const [row] = await db
      .select()
      .from(runs)
      .where(and(eq(runs.workspaceId, ctx.workspaceId), eq(runs.id, id)))
      .limit(1);
    if (!row) throw new AppError("not_found", `Run ${id} not found`);
    return row;
  }

  /** For the worker, which serves every workspace. */
  async getById(id: string): Promise<RunRow | undefined> {
    const [row] = await this.db.select().from(runs).where(eq(runs.id, id)).limit(1);
    return row;
  }

  async list(ctx: LocalContext, query: RunListQuery): Promise<RunRow[]> {
    return this.db
      .select()
      .from(runs)
      .where(
        and(
          eq(runs.workspaceId, ctx.workspaceId),
          query.threadId ? eq(runs.threadId, query.threadId) : undefined,
          query.assistantId ? eq(runs.assistantId, query.assistantId) : undefined,
          query.status ? eq(runs.status, query.status) : undefined,
        ),
      )
      .orderBy(desc(runs.id))
      .limit(query.limit);
  }

  async activeOnThread(threadId: string, db: Executor = this.db): Promise<RunRow | undefined> {
    const [row] = await db
      .select()
      .from(runs)
      .where(and(eq(runs.threadId, threadId), inArray(runs.status, ACTIVE_RUN_STATUSES)))
      .limit(1);
    return row;
  }

  async update(id: string, patch: RunPatch, db: Executor = this.db): Promise<RunRow> {
    const [row] = await db.update(runs).set(patch).where(eq(runs.id, id)).returning();
    if (!row) throw new AppError("not_found", `Run ${id} not found`);
    return row;
  }
}

export function toRun(row: RunRow): Run {
  return runSchema.parse({
    id: row.id,
    threadId: row.threadId,
    assistantId: row.assistantId ?? "unknown",
    assistantVersion: row.targetVersion ?? 1,
    status: row.status,
    input: row.input,
    output: row.output,
    error: row.error ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    startedAt: isoOrNull(row.startedAt),
    finishedAt: isoOrNull(row.finishedAt),
  });
}
