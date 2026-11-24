# ADR 0012: Structured logging

- **Status:** accepted (Phase 13, 2026-10-11)
- **Relates to:** D8 (secrets), D12 (logging built from scratch), ADR 0003, P13.1–P13.4

## Context

Until Phase 13 the app had no logs: errors were swallowed or shown once in
a toast. Support needs a record of what main, Core, the job worker, and
the CLIs did, correlated by run and request, without ever writing a secret.

## Decision

1. **`packages/logger` (layer 0, on `contracts`).** pino with JSON lines.
   Each process calls `configureLogging({ proc, level, dir, console })`
   once; modules create `moduleLogger("graph.worker")` at import time
   (lazy, so they follow the configuration and are silent before it).
   Levels are pino's (`trace`…`fatal`), stored as labels.
2. **Files.** One rotating file per process (`main.log`, `core.log`; 5 MB,
   four older files) written synchronously, so the last lines survive a
   crash and pino needs no worker thread (transports break when bundled).
   Desktop: `~/Library/Logs/Agentic Hub` (elsewhere `<userData>/logs`),
   passed to Core in its start config. Headless Core: `AGENTIC_LOG_DIR`,
   default `<dataDir>/logs`, plus short lines on stderr. Level:
   `AGENTIC_LOG_LEVEL` (default `info`; `debug` for the unpackaged app).
3. **Correlation through AsyncLocalStorage.** `withLogContext({ runId,
   threadId, traceId }, fn)` adds the ids to every line logged inside, so
   cli-bridge and graph code log run ids without knowing them. The job
   worker and run handler open a run scope; Core's HTTP middleware opens a
   request scope with a trace id (the caller's `x-trace-id` or a new one),
   echoes it in the response header, and puts it on `AppError.traceId`.
4. **Redaction on the way in.** A `formatters.log` hook deep-copies every
   object: keys like `token`, `apiKey`, `password`, `authorization`,
   `connectionString`, `secrets` are masked; strings are scrubbed for
   token shapes (`sk-…`, `ghp_…`, `Bearer …`, `postgres://user:pass@`) and
   for the exact values Core holds (`setSecretValues`, fed by its
   `SecretStore`). Errors are flattened with their stack. cli-bridge's
   `redact` now delegates to the same function. CLI arguments are never
   logged, since they carry prompts.
5. **Viewer through main.** The renderer reads logs over IPC
   (`logs.query`), not Core HTTP, so they stay readable when Core is down.
   Main also writes renderer reports (`logs.write`, module `renderer`),
   builds the redacted "Copy diagnostics" bundle (versions, DB/Core/vault
   status without Core's URL or token, recent problems and lines), and
   opens the folder.
6. **Error UX.** `showError` replaces bare error toasts: a hint for known
   codes (`unavailable` → Database settings) and "View logs" filtered to
   the request's trace id. The router's `defaultErrorComponent` keeps the
   shell up when a page throws; `AppErrorBoundary` covers the shell. Both
   and window-level errors are reported to main's log.
7. **Crashes.** `logCrashes` uses `uncaughtExceptionMonitor`, which logs
   without changing how the process reacts (Core still exits and is
   restarted by its supervisor; Electron still shows its dialog).

## Optional exports

LangSmith tracing works without code: LangGraph reads
`LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` from the environment, and
Core inherits main's environment (and the shell's when headless). An
OpenTelemetry exporter and a vault-backed LangSmith setting are in the
Backlog; nothing is exported unless the user opts in.

## Consequences

- Every new package logs through `moduleLogger`; `console.*` stays out of
  library code.
- Log files hold no secrets by construction, so the diagnostics bundle can
  be pasted into an issue.
- Sync writes cost a syscall per line; at `info` the volume is a few lines
  per run, and `debug` is opt-in for packaged builds.
