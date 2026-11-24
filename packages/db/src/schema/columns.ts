import { newId } from "@agentic/contracts";
import { timestamp, uuid } from "drizzle-orm/pg-core";

/** UUIDv7 primary key, generated in the app so ids sort by creation time. */
export const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => newId());

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
