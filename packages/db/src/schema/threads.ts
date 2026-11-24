import { index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { scoped } from "./tenancy";

/**
 * The workspace-scoped index of LangGraph threads. Checkpoints stay in the
 * saver's own tables; this row adds ownership, the assistant, and a status
 * for lists and the Inbox. `id` is the LangGraph `thread_id`.
 */
export const threads = pgTable(
  "threads",
  {
    id: id(),
    ...scoped(),
    assistantId: text("assistant_id").notNull(),
    assistantVersion: integer("assistant_version").notNull(),
    status: text("status").notNull().default("idle"),
    metadata: jsonb("metadata").notNull().default({}),
    forkedFrom: jsonb("forked_from"),
    ...timestamps(),
  },
  (t) => [
    index("threads_workspace_updated").on(t.workspaceId, t.updatedAt),
    index("threads_workspace_status").on(t.workspaceId, t.status),
  ],
);
