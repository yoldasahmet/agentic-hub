import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, timestamps } from "./columns";
import { scoped } from "./tenancy";

/**
 * One table for chat, agent, and workflow runs. Run state itself lives in
 * LangGraph checkpoints (`thread_id`); this row is the index and summary.
 */
export const runs = pgTable(
  "runs",
  {
    id: id(),
    ...scoped(),
    kind: text("kind").notNull(),
    /** The registry key of the graph this run executes (pinned with `target_version`). */
    assistantId: text("assistant_id"),
    targetId: uuid("target_id"),
    targetVersion: integer("target_version"),
    threadId: text("thread_id").notNull(),
    parentRunId: uuid("parent_run_id"),
    status: text("status").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    error: jsonb("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("runs_workspace_updated").on(t.workspaceId, t.updatedAt),
    index("runs_thread").on(t.threadId),
    index("runs_status").on(t.status),
  ],
);

/** Persisted before broadcast; clients replay from a `seq` cursor. */
export const runEvents = pgTable(
  "run_events",
  {
    id: id(),
    ...scoped(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("run_events_run_seq").on(t.runId, t.seq)],
);

/**
 * The job queue (D11). Workers claim with `FOR UPDATE SKIP LOCKED` and hold
 * a lease, so each job runs once across every app sharing the DB.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    ...scoped(),
    kind: text("kind").notNull(),
    runId: uuid("run_id").references(() => runs.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(0),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps(),
  },
  (t) => [
    index("jobs_claim").on(t.status, t.priority, t.runAfter),
    index("jobs_lease").on(t.leaseExpiresAt),
  ],
);

/** Manual, schedule, GitHub, and Jira triggers that start a target (open set: text). */
export const triggers = pgTable(
  "triggers",
  {
    id: id(),
    ...scoped(),
    kind: text("kind").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: uuid("target_id").notNull(),
    config: jsonb("config").notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    nextFireAt: timestamp("next_fire_at", { withTimezone: true }),
    lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("triggers_due").on(t.enabled, t.nextFireAt)],
);
