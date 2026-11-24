import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { scoped } from "./tenancy";

/**
 * Each chat is a LangGraph thread; `target_kind` is app / agent / workflow
 * (text + Zod). Messages live in the thread's checkpoints, not here.
 * `model` is a `{ providerId, model }` choice; null uses the default.
 */
export const chats = pgTable(
  "chats",
  {
    id: id(),
    ...scoped(),
    title: text("title").notNull().default(""),
    targetKind: text("target_kind").notNull(),
    targetId: uuid("target_id"),
    threadId: text("thread_id").notNull(),
    model: jsonb("model"),
    workingDir: text("working_dir"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("chats_thread").on(t.threadId),
    index("chats_workspace_updated").on(t.workspaceId, t.updatedAt),
  ],
);
