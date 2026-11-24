import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";

/**
 * `kind` is an open set: "local" is the account bootstrap creates (no
 * password, auto sign-in on the local DB); "password" has signed up (P17).
 * The first sign-up claims the local account, so its rows keep their owner.
 */
export const users = pgTable(
  "users",
  {
    id: id(),
    kind: text("kind").notNull().default("local"),
    displayName: text("display_name").notNull(),
    email: text("email"),
    /** scrypt hash (`scrypt$N$r$p$salt$hash`); null for the local account. */
    passwordHash: text("password_hash"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps(),
  },
  (t) => [uniqueIndex("workspaces_slug_key").on(t.slug)],
);

/** `workspace_id` + `created_by`: every tenant row carries both (docs/architecture.md). */
export const scoped = () => ({
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
});

export const settings = pgTable(
  "settings",
  {
    id: id(),
    ...scoped(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("settings_workspace_key").on(t.workspaceId, t.key)],
);
