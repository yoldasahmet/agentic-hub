import { defineConfig } from "drizzle-kit";

// `pnpm db:generate` diffs the schema against drizzle/ and writes a new SQL migration.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
});
