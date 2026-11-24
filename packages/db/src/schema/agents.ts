import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, timestamps } from "./columns";
import { versionedDocument } from "./identity";
import { scoped } from "./tenancy";

export const agents = pgTable(
  "agents",
  {
    id: id(),
    ...scoped(),
    ...versionedDocument(),
    /** Bumped by each draft save: the optimistic lock for autosave. */
    revision: integer("revision").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("agents_workspace_slug").on(t.workspaceId, t.slug),
    index("agents_workspace_updated").on(t.workspaceId, t.updatedAt),
  ],
);

/** Immutable once published: runs pin a version, so rows are never updated. */
export const agentVersions = pgTable(
  "agent_versions",
  {
    id: id(),
    ...scoped(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    kind: text("kind").notNull(),
    inputSchema: jsonb("input_schema").notNull(),
    outputSchema: jsonb("output_schema").notNull(),
    outputFormat: text("output_format").notNull().default("markdown"),
    prompt: jsonb("prompt").notNull(),
    runtime: jsonb("runtime").notNull(),
    capabilities: jsonb("capabilities").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("agent_versions_agent_version").on(t.agentId, t.version)],
);
