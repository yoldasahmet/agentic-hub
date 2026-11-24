import { defineConfig } from "vitest/config";

/**
 * One Vitest workspace for the monorepo (P14.1). Projects split by what a
 * test needs:
 * - `unit`: pure Node tests (`*.test.ts`), no services;
 * - `integration`: `*.int.test.ts`, with an ephemeral Postgres per run
 *   (packages/testing) and a fresh database per file;
 * - `ui`: React component tests (`*.test.tsx`, and all of packages/ui) in jsdom.
 * Playwright E2E lives in apps/desktop/e2e and runs with `pnpm test:e2e`.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["{packages,apps}/*/src/**/*.test.ts"],
          exclude: ["**/*.int.test.ts", "**/node_modules/**", "packages/ui/**"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["{packages,apps}/*/src/**/*.int.test.ts"],
          environment: "node",
          globalSetup: ["./packages/testing/src/postgres/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        // The automatic JSX runtime: apps/desktop has no plain tsconfig.json
        // to say so (its tsconfig.web.json does), unlike packages/ui.
        esbuild: { jsx: "automatic" },
        test: {
          name: "ui",
          include: ["packages/ui/src/**/*.test.{ts,tsx}", "{packages,apps}/*/src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./packages/ui/src/test/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}", "apps/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/test/**", "packages/testing/**", "**/index.ts"],
      reporter: ["text-summary", "html", "lcov"],
    },
  },
});
