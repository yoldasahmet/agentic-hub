# ADR 0003: Embedded Core and the LangGraph runtime

- **Status:** accepted (Phase 4, 2026-10-10)
- **Relates to:** D3 (embedded core), D4 (LangGraph), D9 (transport), D11 (job queue), P4.1–P4.10
- **Amends:** ADR 0002 §6 (Core now holds the pool, migrations, and bootstrap)
- **Amended by:** ADR 0014 §1 (foreign origins refused before the token check), ADR 0015 §1, §6 (a session picks the user; the local DB may auto sign in)

## Context

Phase 4 turns the app into a local LangGraph server: an embedded backend
that main supervises, a threads/runs/state API, an event pipeline, human
gates, and a job queue that must stay correct on a shared team DB.

## Decision

1. **Process.** `packages/core` exposes `startCore(config)`. Electron runs
   it in a `utilityProcess` (`apps/desktop/src/core/index.ts` → bundled to
   `out/main/core.js`); `pnpm --filter @agentic/core start` runs the same
   entry under Node. Main sends the start config, including DB credentials,
   over the process port after spawn, never via env or argv. Core answers
   `ready` (URL, port, token, DB info) or `failed`.
2. **Supervision.** `CoreSupervisor` restarts a Core that crashed after
   being ready (backoff, at most five times a minute). A Core that fails to
   start is reported, not retried. A DB switch tests the target in main
   first (main keeps `@agentic/db` for `testConnection` only), then
   replaces Core. Quit sends `shutdown`: Core hands its running jobs back
   to the queue, then exits.
3. **Transport.** Core listens on `127.0.0.1:0` (OS-picked port). Every route
   except `/health` needs `Authorization: Bearer <token>` (256-bit, per
   launch, constant-time compare), and the `Host` must be loopback (DNS
   rebinding). WebSockets (`/ws`) carry the token in the query string,
   because browsers can't set headers there. Core writes
   `<dataDir>/runtime/core.json` (folder 0700, file 0600, atomic) for the
   CLI, and removes it on stop when the pid matches.
4. **Storage.** The official `PostgresSaver` and `PostgresStore` live in their
   own `langgraph` schema. Their `setup()` runs under an advisory lock. A
   `threads` table (migration `0001_threads`) adds workspace scoping, the
   pinned assistant version, a status for lists and the Inbox, and fork
   provenance. Checkpoints are never copied into app tables.
5. **Runs.** A run is one execution of a pinned assistant on a thread, and it
   stays one run across its gates: `POST /runs/:id/resume` queues a new job
   for the same run, so the run view and its event stream are continuous.
   Each thread has at most one active run (queued, running, or waiting),
   enforced under a per-thread advisory transaction lock. Editing the state
   of a waiting run re-queues it to continue from the edit, so its gate asks
   again with the new values (or moves on if the edit was written as the
   gate node).
6. **Events.** Stream modes `updates`, `messages`, and `custom` map to
   `contracts` events. They are persisted to `run_events` with a gap-free
   per-run `seq`, then published on the in-memory `EventBus`. The WS hub
   buffers live events while it replays from `after`, then de-duplicates by
   `seq`. The client re-subscribes from its last `seq` after a reconnect.
7. **Jobs.** Workers claim with `FOR UPDATE SKIP LOCKED`, hold a lease that
   heartbeats renew, and see cancel flags set by any instance. Expired
   leases are reclaimed. Lease owners are `<host>:<pid>:<random>`, so after
   a crash on the same machine the next Core reclaims the dead pid's jobs at
   once instead of waiting for the lease to expire. A retried run job
   compares the thread head with the checkpoint recorded at enqueue time:
   if the first attempt made progress, it continues from the checkpoint
   (`stream(null)`), so finished nodes never run twice.
8. **Module shape.** Graph-backed Core modules (assistants, threads, runs,
   inbox) are `routes.ts` over the services in `packages/graph`, which own
   their Drizzle queries because the worker needs them too. App-owned
   modules from Phase 6 on follow `routes → service → repository` inside Core.
9. **Bundling.** Electron main bundles workspace packages, but `ws` stays an
   external dependency of `apps/desktop`: bundling it breaks its optional
   native helpers and crashes Core on the first frame.
10. **Sample assistant.** `sample` (write → review gate → finish) is a
    built-in graph that exercises the runtime until agents (P6) and
    workflows (P7) register their own versions.

## Consequences

- One API surface for the renderer and the CLI (`packages/client`: Hono RPC
  types plus Zod-parsed responses, and a reconnecting WS client).
- A Core restart brings a new port and token. The renderer swaps its client
  when main pushes the new `core.status`.
- The event bus is in memory. Live views across app instances on a team DB
  need the `LISTEN/NOTIFY` adapter from the Backlog. The data is already
  shared and correct.
- Trigger firing (schedules, GitHub, Jira) builds on the queue in P7.10,
  P10.6, and P11.5.
