import { boolean, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { scoped } from "./tenancy";

/** Enabled models per workspace. Providers themselves are code (the registry), not rows. */
export const models = pgTable(
  "models",
  {
    id: id(),
    ...scoped(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    displayName: text("display_name").notNull(),
    capabilities: jsonb("capabilities").notNull().default({}),
    pricing: jsonb("pricing"),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex("models_workspace_model").on(t.workspaceId, t.providerId, t.modelId)],
);
