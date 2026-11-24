import { type RunEvent, type RunEventDraft, runEventSchema } from "@agentic/contracts";
import { type Database, schema } from "@agentic/db";
import { redactStrings } from "@agentic/logger";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { toJsonSafe } from "../lib/json";
import type { EventBus } from "./event-bus";

const { runEvents } = schema;

export type EventOwner = { id: string; workspaceId: string; createdBy: string };

/**
 * Persists run events with a gap-free per-run `seq`, secrets masked, then
 * broadcasts them.
 * Only one job runs a given run at a time, and the unique (run_id, seq)
 * index rejects a duplicate if that ever breaks.
 */
export class EventLog {
  constructor(
    private readonly db: Database,
    private readonly bus: EventBus,
  ) {}

  async append(run: EventOwner, draft: RunEventDraft): Promise<RunEvent> {
    // Tool output is masked already; this also catches model text and CLI
    // errors, so no vault value or token shape is stored or broadcast.
    const payload = redactStrings(toJsonSafe(draft.payload));
    const [row] = await this.db
      .insert(runEvents)
      .values({
        workspaceId: run.workspaceId,
        createdBy: run.createdBy,
        runId: run.id,
        seq: sql`(select coalesce(max(seq), 0) + 1 from run_events where run_id = ${run.id})`,
        type: draft.type,
        payload,
      })
      .returning();
    if (!row) throw new Error("Failed to persist the run event");
    const event = toEvent(row);
    this.bus.publish({ kind: "event", workspaceId: run.workspaceId, event });
    return event;
  }

  async list(
    workspaceId: string,
    runId: string,
    after: number,
    limit: number,
  ): Promise<RunEvent[]> {
    const rows = await this.db
      .select()
      .from(runEvents)
      .where(
        and(
          eq(runEvents.workspaceId, workspaceId),
          eq(runEvents.runId, runId),
          gt(runEvents.seq, after),
        ),
      )
      .orderBy(asc(runEvents.seq))
      .limit(limit);
    return rows.map(toEvent);
  }
}

function toEvent(row: typeof runEvents.$inferSelect): RunEvent {
  return runEventSchema.parse({
    id: row.id,
    runId: row.runId,
    seq: row.seq,
    type: row.type,
    at: row.createdAt.toISOString(),
    payload: row.payload,
  });
}
