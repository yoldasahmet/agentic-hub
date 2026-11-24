import { integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Columns shared by versioned documents (agents, workflows): identity,
 * an autosaved draft, and a pointer to the latest published version (D10).
 */
export const versionedDocument = () => ({
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  description: text("description").notNull().default(""),
  draft: jsonb("draft").notNull().default({}),
  latestVersion: integer("latest_version"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});
