import { index, integer, jsonb, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, timestamps } from "./columns";
import { versionedDocument } from "./identity";
import { scoped } from "./tenancy";

/** The draft is one document (nodes, edges, bindings). `revision` is the optimistic lock. */
export const workflows = pgTable(
  "workflows",
  {
    id: id(),
    ...scoped(),
    ...versionedDocument(),
    revision: integer("revision").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("workflows_workspace_slug").on(t.workspaceId, t.slug),
    index("workflows_workspace_updated").on(t.workspaceId, t.updatedAt),
  ],
);

export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: id(),
    ...scoped(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    document: jsonb("document").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("workflow_versions_workflow_version").on(t.workflowId, t.version)],
);

/**
 * A draft run pins the draft as it was: one immutable row per saved
 * revision, with every `latest` reference resolved. The draft assistant
 * (`workflow-draft:<id>`) runs version = revision from here.
 */
export const workflowSnapshots = pgTable(
  "workflow_snapshots",
  {
    id: id(),
    ...scoped(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    document: jsonb("document").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("workflow_snapshots_workflow_revision").on(t.workflowId, t.revision)],
);
