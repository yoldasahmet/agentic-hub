import { defineConfig } from "@playwright/test";

/**
 * Electron E2E (P14.6). Runs the built app (`pnpm --filter @agentic/desktop
 * build` first) with a throwaway profile: its own local Postgres, vault,
 * and Core. macOS only, like the app.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../../coverage/e2e-report" }]],
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
});
