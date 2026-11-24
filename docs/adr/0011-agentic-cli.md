# ADR 0011: The `agentic` CLI

- **Status:** accepted (Phase 12, 2026-10-11)
- **Relates to:** D3 (embedded core), D9 (transport), ADR 0003, P12.1–P12.4
- **Amended by:** ADR 0015 §7 (`agentic login`, `AGENTIC_SESSION`), ADR 0016 §6 (the packaged CLI is a bundle on the user's Node)

## Context

Phase 12 adds a command line for scripts, CI, and people who live in a
terminal. It must use the same API as the UI (no second surface), find the
running app without configuration, and run Core without the app.

## Decision

1. **`apps/cli` on `packages/client`.** Every command goes through the
   typed HTTP client and `CoreSocket`, exactly like the renderer. A
   dependency-cruiser rule (`cli-layers`) lets the CLI import only
   `contracts`, `client`, and `core`; `core` is loaded only for `serve`
   (dynamic import) and for `@agentic/core/paths`, a tiny subpath export
   with the runtime-file path, so ordinary commands start fast.
2. **Finding Core.** `AGENTIC_URL` + `AGENTIC_TOKEN` win. Otherwise the CLI
   reads `runtime/core.json` from `--data-dir` / `AGENTIC_DATA_DIR`, else
   from the desktop app's `userData` folder and then `~/.agentic` (the
   headless default), and connects to the newest file whose `pid` is
   alive. A file left by a crashed Core is never used; `doctor` reports it
   as stale.
3. **Commands.** `status`, `doctor`, `agents list|run`,
   `workflows list|run|resume`, `runs list|logs [--follow]`,
   `threads state get|set`, `serve`. Agents and workflows are addressed by
   id or slug. Every command takes `--json`. Runs are followed over the
   WebSocket (replayed from `seq`, so nothing is missed) until they end or
   wait at a gate; `resume` follows from the log's last `seq`, so an
   earlier `waiting` doesn't stop it. Exit codes: 0 succeeded, 3 waiting at
   a gate, 1 failed, canceled, or an error.
4. **Answering gates.** `--approve` / `--reject` build the answer for the
   gate's kind from its interrupt value (`{ action, data?, comment? }` for
   workflow gates and reviews, `{ approved, note? }` for tool approvals),
   validated with the contract schemas; `--answer '<json>'` sends anything
   else. Several waiting gates need `--interrupt <id>`.
5. **`agentic serve`** runs the same headless entry as
   `pnpm --filter @agentic/core start` (`startHeadlessCore`, configured by
   the `AGENTIC_*` environment). It writes the same runtime file, so other
   commands find it.
6. **Launcher and install.** `bin/agentic.mjs` registers `tsx` and imports
   the TypeScript source, like the rest of the workspace. "Install Command
   Line Tool…" (app menu; File on other platforms) symlinks `agentic` into
   `/usr/local/bin` when writable (no admin prompt), else `~/.local/bin`,
   replacing an older link but never a real file, and says when that folder
   isn't on `PATH`. Packaged builds point at `resources/cli/agentic`, which
   P18.7 bundles as a self-contained script.

## Consequences

- One API: anything the CLI can do, the UI can do, and vice versa.
- The dev launcher needs the repo's `node_modules`; a packaged app needs
  P18.7 before the menu item works there (it reports the missing file
  instead of linking it).
- `logs --follow` keeps following a run that waits at a gate, since it may
  be answered from the app; `run` and `resume` stop there instead.
