# ADR 0013: Testing

- **Status:** accepted (Phase 14, 2026-10-12)
- **Relates to:** D12 (tests built from scratch), D11 (job queue), ADR 0003, ADR 0006, P14.1–P14.6

## Context

Until Phase 14 the only checks were lint, layer rules, file size, and
types. The runtime pieces that matter most (the job queue's leases, event
persistence and replay, the workflow compiler, gates) only ran by hand.

## Decision

1. **One Vitest workspace at the root** (`vitest.config.ts`) with three
   projects, picked by file name, so a package needs no config of its own:
   - `unit`: `*.test.ts`, pure Node;
   - `integration`: `*.int.test.ts`, with a real Postgres;
   - `ui`: `*.test.tsx` and everything in `packages/ui`, in jsdom.
   Tests sit next to the code (`src/**`), so `tsc` type-checks them.
   Shared fixtures go in `src/test/`. `pnpm test` runs all three;
   `pnpm test:coverage` adds v8 coverage (`coverage/`).
2. **`packages/testing` (test-only).** Helpers that every package's tests
   share: the ephemeral Postgres, per-file databases, and `fakeProvider`
   (a scripted `LlmProvider`). dependency-cruiser lets only test files
   import it (`testing-only-in-tests`), and tests otherwise follow their
   package's layer rules. `db` and `llm` don't import it (that would be a
   workspace cycle); their database tests live in `core`.
3. **Ephemeral Postgres, not mocks.** The integration project's global
   setup starts a throwaway cluster from the app's own bundled binaries
   (temp dir, trust auth on loopback, `fsync=off`) and stops it after the
   run. Each test file gets a fresh migrated database with the default
   workspace (`createTestDatabase`). As root (CI containers) the server
   runs as `nobody`, since Postgres refuses root. `AGENTIC_TEST_DATABASE_URL`
   points the run at a server you manage instead.
4. **Providers on recorded fixtures.** CLI parsers replay JSONL captures in
   `cli-bridge/src/parsers/fixtures/`; OpenRouter gets a `fetch` stand-in
   that streams SSE in odd chunk sizes. No test needs a CLI or network.
5. **Core end to end in process.** `startCore` takes `extraProviders`, so
   integration tests run the full HTTP + graph host + worker with the fake
   provider: agent → workflow → run → gate → result over HTTP.
6. **Electron E2E with Playwright** (`apps/desktop/e2e`, `pnpm test:e2e`).
   It builds the app, launches it on a throwaway profile
   (`AGENTIC_USER_DATA_DIR`), sets up through the app's own Core, and drives
   the chat UI. It uses a `human` agent, so it needs no LLM sign-in. It runs
   on macOS only and is not in CI yet.

## Consequences

- CI's `tests` job runs `pnpm test:coverage` on macOS and keeps the report.
- New behavior comes with tests (AGENTS.md → Verification).
- Coverage has no threshold yet; one can be added once the suite settles.
- E2E selectors follow the UI's accessible names; renaming a button may
  need a spec update.
