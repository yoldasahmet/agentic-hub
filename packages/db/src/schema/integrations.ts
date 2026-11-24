import { boolean, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { scoped } from "./tenancy";

/** `secret_ref` is a vault secret name. Secret values never reach Postgres (D8). */
export const integrationAccounts = pgTable(
  "integration_accounts",
  {
    id: id(),
    ...scoped(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    config: jsonb("config").notNull().default({}),
    secretRef: text("secret_ref"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("integration_accounts_name").on(t.workspaceId, t.kind, t.name)],
);

export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: id(),
    ...scoped(),
    name: text("name").notNull(),
    transport: text("transport").notNull(),
    config: jsonb("config").notNull().default({}),
    secretRef: text("secret_ref"),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex("mcp_servers_name").on(t.workspaceId, t.name)],
);

/** `source` is inline (content in the row) or directory (a local path). */
export const skills = pgTable(
  "skills",
  {
    id: id(),
    ...scoped(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    source: text("source").notNull(),
    content: text("content"),
    path: text("path"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("skills_slug").on(t.workspaceId, t.slug)],
);
