# Architecture

How Agentic Hub is built. `ROADMAP.md` says **when** each part is built;
this file says **how the parts fit**, and describes the code as it is
(Phases 1–15). Decisions and their history are in the ADRs
([`adr/README.md`](adr/README.md)); `docs/reference-review.md` explains why
it differs from the reference repo. For using the app, see the
[user guide](user-guide/README.md); for working on it,
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Principles

1. **Easy to read.** One concept per file. Hard limit 250 lines, aim for
   ≤150. Feature folders. Each package exposes its public API through
   `index.ts` only.
2. **One source of truth per fact.**
   - Contracts: Zod in `packages/contracts`.
   - Run state: LangGraph checkpoints.
   - Secrets: the Keychain vault.
   - Providers: the provider registry.
3. **Generic engine, behavior as data.** Agents, workflows, templates, and
   built-ins are versioned data. The runtime has no role-specific code.
4. **Plugins at the edges.** LLM providers, integrations, tools, and output
   renderers register through small interfaces. Adding one never needs a
   migration.
5. **Local-first, team-ready.** Runs on a local Postgres service by default.
   The same code is safe on a shared team database.
6. **Reuse before create.** Check `packages/ui` (see the component catalog
   in `docs/design-system.md`) and existing modules before writing new code.

## Process model

```
┌──────────────────────────── Agentic Hub (Electron) ────────────────────────────┐
│ Main process (thin)              Renderer (React)                              │
│  windows · menus · vault ◄─IPC─►  routes/<feature> ── typed client ──┐         │
│  supervises ▼            ▼                                          │ HTTP+WS │
│  ┌──────────────────┐  ┌───────────────────────────────────────────▼───────┐ │
│  │ Local Postgres   │  │ Core (utilityProcess, embedded)                     │ │
│  │ service (bundled │◄─┤  Hono API · LangGraph runtime · job queue ·         │ │
│  │ binaries)        │  │  scheduler · integrations · spawns CLI processes    │ │
│  └──────────────────┘  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────┬────────────────────────────────┘
             or a remote team DB (connection string in Settings)
  apps/cli ── typed client ──► Core   ·   `agentic serve` runs Core under Node (headless)
```

- **Main** stays thin: windows, menus, the secrets vault, and supervision of
  Postgres and Core. It never runs business logic.
- **Core** is the embedded backend and the local LangGraph server. It runs
  in an Electron `utilityProcess`: shipped inside the app and started and
  stopped with it. Running it outside main keeps the UI responsive and lets
  Core restart after a crash without the app restarting. The same entry
  point runs under plain Node for headless and CLI use.
- **Main ↔ renderer IPC** is declared once in `packages/contracts/src/ipc/`
  and validated on both sides. Secret values are write-only from the
  renderer (see `docs/adr/0001-desktop-ipc-and-secrets.md`).
- **Renderer and CLI** use the same typed client, talking HTTP + WS to Core
  on `127.0.0.1` with a per-launch token. There is one API surface, so the
  CLI and UI never drift apart.

## Packages and layers

Dependencies point **down only** (one sideways exception: `chat` uses
`workflows`). dependency-cruiser enforces the exact map in
`.dependency-cruiser.cjs` in CI.

| Layer | Package | Responsibility | May depend on |
| --- | --- | --- | --- |
| 0 | `contracts` | Zod schemas + inferred types: entities, API DTOs, events, IPC | `zod` |
| 0 | `logger` | pino structured logs: rotating files, redaction, run/trace context, log reader | `contracts` |
| 1 | `db` | Drizzle schema per module, migrations, connection manager (local/remote) | 0 |
| 1 | `local-postgres` | Init, start, stop, and health of the bundled Postgres service | 0 |
| 1 | `cli-bridge` | The **only** place that spawns CLIs: process, PTY, stream parsers | 0 |
| 2 | `llm` | `LlmProvider` interface, registry, catalog, usage/cost. CLI and OpenRouter providers. | 0–1 |
| 2 | `tools` | Tool registry, permission levels, approval policy, MCP client, skills | 0–1 |
| 2 | `graph` | LangGraph host: saver/store, threads, runs, streaming, interrupts, job queue | 0–1 |
| 3 | `integrations` | `github/`, `jira/`: clients, tools, triggers, local git | 0–2 |
| 3 | `agents` | Agent version → LangGraph node: prompt render, provider call, output validation | 0–2 |
| 4 | `workflows` | Bindings, JSON-logic, validation, compiler → `StateGraph`, template importer | 0–3 |
| 4 | `chat` | Chat orchestrator graphs: App / Agent / Workflow targets | 0–3, `workflows` (to run workflow targets) |
| 5 | `core` | Composition root: Hono app, feature modules, WS hub, bootstrap | 0–4 |
| 6 | `client` | Typed HTTP (Hono RPC) + WS client with reconnect and replay | 0, `core` types only |
| 6 | `ui` | Design tokens, shadcn primitives, patterns, feature components | 0 |
| test | `testing` | Test-only: ephemeral Postgres, per-file databases, fake LLM provider. Only `*.test.ts(x)` and `src/test/` import it. | 0–2 |
| app | `apps/desktop` | main → `core` (as a process), `local-postgres`, `db` (connection test only) · renderer → `ui`, `client` | — |
| app | `apps/cli` | `agentic` commands → `client` (`core` for `serve` and `core/paths` only) | — |

### Inside a package

```
packages/core/src/modules/<feature>/
  routes.ts       HTTP handlers: Zod in, Zod out, no logic
  service.ts      use cases, transactions, authorization
  repository.ts   Drizzle queries only
  index.ts        registers the module
packages/ui/src/
  tokens/         CSS variables (design-system.md)
  primitives/     shadcn/Radix components, unmodified API
  patterns/       SchemaForm, EventStream, EntityChip, StateInspector, …
  features/       presentational feature components (no data fetching)
apps/desktop/src/renderer/routes/<feature>/
  page.tsx        composition only
  queries.ts      TanStack Query hooks over packages/client
```

The call chain is `routes → service → repository`. Modules call each other
through services, never through another module's repository. Graph-backed
modules (assistants, threads, runs, inbox) are routes over the services in
`packages/graph`, which owns their queries because the job worker needs them
too (ADR 0003).

## Data model (v1)

Every row carries `workspace_id` and `created_by`. IDs are UUIDv7
(time-sortable). Open-ended sets (event types, providers, node kinds) are
`text` columns validated by Zod, never pg enums.

| Group | Tables |
| --- | --- |
| Tenancy | `workspaces`, `users` (`local` bootstrap account or `password` with a scrypt hash), `settings` |
| Auth | `workspace_members` (owner/member) · `auth_sessions` (SHA-256 of the session token, client, expiry) |
| Catalog | `models` (provider id, model id, capabilities, pricing). Providers themselves are code. |
| Agents | `agents` (identity: name, slug, color, icon; autosaved `draft` with a `revision` lock) · `agent_versions` (immutable: kind, I/O schemas, output format, prompt, runtime, capabilities) |
| Workflows | `workflows` (identity + mutable draft with a `revision` lock) · `workflow_versions` (immutable graph document: nodes, edges, bindings, every reference pinned) · `workflow_snapshots` (the pinned draft a draft run executes, one per revision) |
| Execution | `threads` (LangGraph `thread_id`, pinned assistant + version, status, fork origin) · `runs` (kind, `assistant_id`, target + version, `thread_id`, status, I/O) · `run_events` (`run_id`, `seq`, type, payload; unique `run_id`+`seq`) · `jobs` (lease owner + expiry) · `triggers` |
| LangGraph | Tables created by `PostgresSaver.setup()` and `PostgresStore.setup()` in the `langgraph` schema. No copies. |
| Chat | `chats` (title, target kind app/agent/workflow, target id, model, working dir, `thread_id`); messages live in the thread's checkpoints |
| Integrations | `integration_accounts` (kind, non-secret config, vault secret ref), `mcp_servers`, `skills` |

Workflows are stored as **one versioned document**, not node/edge rows.
That keeps publish, fork, diff, and import/export simple. Drafts autosave
with optimistic locking, and runs pin the version they started on.

## Runtime flows

**Agent run.** `POST /agents/:id/runs {version, input, model?}` → the
agents service checks the inputs against the `inputSchema` and starts a
run of `agent:<id>` pinned to the version (or `agent-draft:<id>` with the
draft snapshot in its input) → worker claims the job → the registry
resolves the assistant through the agents module's `AssistantSource` →
`agents` builds a one-node graph, renders the prompt, calls `llm`
(fallbacks on failure), validates the output against `outputSchema`
(repair + retry) → LLM events stream as `custom` run events → run
finalized. `human` agents pause at an `interrupt`; `tool` agents call a
tool after its approval (ADR 0005, ADR 0008).

**Workflow run.** `POST /workflows/:id/runs {version, input}` → the
runner checks the inputs, and for a draft validates, pins every `latest`
reference, and stores a snapshot → a run of `workflow:<id>` (or
`workflow-draft:<id>` at revision + 1) → the workflows module's
`AssistantSource` resolves the pinned document with its agent specs and
subworkflows → `workflows` compiles it to a `StateGraph` with the
channels `input`, `nodes`, `overrides`, `output`. Outgoing edges fan out in
parallel when their conditions hold, joins are deferred nodes, loop edges
are capped by the target's run count, reviews are their own graph nodes,
and subworkflows run as subgraphs. Gates and reviews pause the run;
pending interrupts feed the **Inbox**, and resuming sends
`Command({ resume })`, keyed by interrupt id when several wait at once.
Node status and agent stream events are `custom` run events (ADR 0006).

**Triggers.** Manual, scheduled, GitHub, and Jira triggers start a
published workflow version with saved inputs. A throttled sweep on the job
worker's tick claims due schedules and GitHub/Jira polls (`SKIP LOCKED`)
and enqueues `trigger.fire`, `trigger.github.poll`, or `trigger.jira.poll`
jobs in the same transaction, so each due time runs once across instances.
A poll saves its cursor and seen keys before it starts one run per new
issue, review request, or JQL match (ADR 0009, ADR 0010).

**Chat with a target.** Each chat is a LangGraph thread running a
`chat` orchestrator graph:

```
user msg → intake ──(inputs missing)──► ask: inline SchemaForm card ──► intake
                 └─(inputs complete)──► execute ─► respond ─► wait for next msg
```

- **App:** a general assistant on the chosen provider/model, with app tools
  to find and run agents and workflows and read GitHub/Jira items.
- **Agent:** intake extracts the agent's `inputSchema` fields from the
  message and asks for missing required fields. Then it runs the agent
  version as a subgraph. Follow-ups refine the result.
- **Workflow:** the same intake for the workflow inputs. Node progress shows
  inline, and gates appear as approve/edit cards inside the chat.
- **Mechanics** (ADR 0007). One built-in `chat` assistant; the target,
  model, and working dir travel in each run's `context`, and messages live
  in the thread state. `execute` runs the target's latest published version
  as a subgraph inside the node, so its events stream into the chat run and
  its gates pause it. The App calls tools through a fenced `tool` block
  (`find`, `run`, and integration `AppTool`s). Sending while the inputs card
  waits answers the card.
- **Terminal mode.** Core owns PTY sessions (`/terminals`, opened through
  `cli-bridge`); output and keystrokes go over the WebSocket, with
  scrollback replay on re-attach.

**Tools, MCP, and skills** (ADR 0008). Core's `Toolbox` resolves an
agent's slots in the run's workspace: built-in tools (`fs`, `git`,
`shell`, `http`, GitHub, Jira) from the `ToolRegistry`, MCP servers
through a connection pool (`mcp.<server>.<tool>`), and skills (inline or a
folder's `SKILL.md`, appended to the system prompt). The agent's approval
policy maps each permission level (read / write / dangerous) to allow, ask,
or deny; "ask" is a `tool.approval` interrupt raised before the first model
call (or before a `tool` agent's call), so a resume never repeats work.
`llm` agents call tools through the fenced `tool` block loop; Claude Code
and Codex run attached MCP servers themselves, limited to the granted
tools. Guardrails per workspace: allowed folders, per-call timeout, output
limit, and secret masking.

**GitHub** (ADR 0009). `packages/integrations/github` wraps Octokit with
rate-limit backoff. Core's `github` module resolves the token on each call
(vault `github.token`, else `gh auth token`), serves the GitHub views,
registers the GitHub tools on the `ToolRegistry`, and gives the chat App
read tools. Device sign-in runs in Core; the token goes to main for the
vault. Agents with the `worktree` working-dir policy get one git worktree
per run (`<data>/git/worktrees/<run>`, branch `agentic/run-<id>`), cloned
from `owner/name` or made from an allowed local repo; git gets the token
through environment config, never argv or `.git/config`.

**Jira** (ADR 0010). `packages/integrations/jira` is a REST v3 client on
`fetch` (Zod-parsed responses, `Retry-After` backoff) with ADF ↔ Markdown
conversion. Core's `jira` module reads the workspace's site and email
(`jira:settings`) and the vault's `jira.token`, serves the Jira views and a
connection test, registers the Jira tools (tools now get `workspaceId`),
and gives the chat App read tools. After any PR is opened, Core links it on
the Jira issues its branch, title, or body names.

**Events.** LangGraph stream modes (`updates`, `messages`, `custom`) are
mapped to `contracts` events, persisted to `run_events` with a sequence
number, then published on the `EventBus` and sent to WS clients. Clients
re-subscribe with `after=<seq>` and get exactly the events they missed.

**Core.** Main spawns Core as a `utilityProcess` and sends its config over
the process port. Core listens on `127.0.0.1` on a free port, requires the
per-launch token, and writes `runtime/core.json` (0600) for the CLI. A run
stays one run across its gates; jobs hold leases, so a crashed Core's runs
resume from their last checkpoint (ADR 0003).

**CLI.** `agentic` (apps/cli) uses the same typed client. It finds Core
through `AGENTIC_URL` + `AGENTIC_TOKEN`, or the newest live
`runtime/core.json` (desktop `userData`, then `~/.agentic`); `agentic serve`
runs headless Core and writes that file too. Runs are followed over the
WebSocket until they end or wait at a gate (exit 3). The app menu's
"Install Command Line Tool…" symlinks it into `PATH` (ADR 0011).

## LLM providers

```ts
interface LlmProvider {
  id: string;                         // "claude-code" | "codex" | "gemini" | "opencode" | "openrouter"
  name: string;
  transport: "cli" | "api";
  capabilities: ProviderCapabilities; // streaming, tools, structuredOutput (native | extract), reasoning, images, mcp
  detect(): Promise<ProviderStatus>;  // installed? version? signed in?
  listModels(): Promise<ModelInfo[]>;
  stream(req: LlmRequest, signal?: AbortSignal, extras?: CliExtras): AsyncIterable<LlmEvent>;
  // extras: MCP servers for CLIs with their own MCP client (capabilities.mcp)
}
```

| Provider | Transport | Headless entry point | Auth |
| --- | --- | --- | --- |
| Claude Code | CLI | `claude -p --output-format stream-json --verbose --include-partial-messages --no-session-persistence` | the CLI's own login (`claude auth status`) |
| Codex | CLI | `codex exec --json --skip-git-repo-check --sandbox read-only -` | the CLI's own login (`codex login status`) |
| Gemini CLI | CLI | `gemini --output-format stream-json --prompt=…` | API key env or cached Google sign-in |
| OpenCode | CLI | `opencode run --format json -- …` | `opencode auth login` credentials |
| OpenRouter | HTTP API (OpenAI-compatible) | `POST /api/v1/chat/completions` (SSE) | API key in the vault |

Every provider emits the same `LlmEvent`s: text, thinking, tool call, tool
result, structured, usage, error, and a final `done`. Failures are events,
not exceptions. Structured output uses a provider's native schema option
where it exists, otherwise prompt + JSON extraction; both are validated
against the JSON Schema and repaired up to two times.

- **Layers.** `cli-bridge` spawns (search PATH, cwd check, env allowlist,
  process groups, cancel/timeout, redaction, PTY) and parses; `llm` wraps
  specs as providers, adds OpenRouter, the catalog
  (`packages/llm/config/llm-catalog.json`), cost, structured output, and
  fan-out compare. Core's `llm` module serves `/llm/providers`, `/llm/models`
  (enable/disable, OpenRouter sync), `/llm/call`, `/llm/stream` (NDJSON),
  and `/llm/compare`.
- **Secrets.** Main hands vault provider secrets to Core over the process
  port at start and on change; Core keeps them in memory (ADR 0004).

## Database modes

- **Local (default).** Bundled Postgres binaries managed by the app, in
  development too, with no Docker. Data lives in
  `~/Library/Application Support/Agentic/postgres`. Postgres listens on
  a free port on `127.0.0.1` with a generated password kept in the vault.
- **Remote (team).** Settings → Database takes a connection string
  (stored in the vault) and a TLS mode, with **Test connection** and
  **Switch and restart**. Switching restarts Core, which applies
  migrations on start. Data is not moved automatically;
  agents and workflows move via export/import bundles.
- **Team safety.** Workspace scoping on every query. Migrations run under a
  Postgres advisory lock. Jobs use leases, so each run, schedule, and
  trigger executes exactly once across all app instances.
- **Mechanics** (ADR 0002). `packages/local-postgres` runs `initdb` and
  `postgres` from the `@embedded-postgres/<os>-<arch>` binary packages.
  Non-secret settings (mode, TLS) live in `<userData>/database.json`.
  `packages/db` opens the pool, migrates under the lock, and bootstraps the
  default workspace and its local owner (the first sign-up claims it). Core runs this on start; main's
  `DatabaseSupervisor` picks the target, tests it, and (re)starts Core on it.

## Logging

Each process writes JSON lines through `packages/logger` (ADR 0012): main
to `main.log` (renderer reports included), Core to `core.log`, both in
`~/Library/Logs/Agentic Hub` (headless: `<dataDir>/logs`). Lines carry
`proc`, `module`, and, inside `withLogContext`, `runId`, `threadId`, and
`traceId`; Core's HTTP middleware sets the trace id and returns it as
`x-trace-id` and on `AppError.traceId`. Secrets are redacted before a line
is written (secret-named keys, token shapes, and the values Core holds).
The renderer reads logs through main (`logs.query`), so Settings → Logs
works while Core is down; "Copy diagnostics" builds a redacted bundle.
`AGENTIC_LOG_LEVEL` sets the level.

## Testing

One Vitest workspace (ADR 0013): `unit` (`*.test.ts`), `integration`
(`*.int.test.ts`, a throwaway Postgres from the bundled binaries and a fresh
database per file), and `ui` (`*.test.tsx`, jsdom). Tests live next to the
code. CLI parsers replay recorded JSONL; OpenRouter gets a `fetch`
stand-in; Core runs in process with a scripted provider
(`CoreOptions.extraProviders`). Electron E2E uses Playwright on a throwaway
profile (`AGENTIC_USER_DATA_DIR`).

## Auth

Basic accounts (ADR 0015, D13). Core's `modules/auth` owns sign-up,
sign-in, sign-out, members, and the sign-in settings. Each request carries
the per-launch token (transport) and, unless auto sign-in applies, a
session token in `x-agentic-session` (`?session=` on the WebSocket).
`resolvePrincipal` turns it into a `Principal`; `requireSignedIn` puts its
workspace and user in `ctx` for every module route, so services stay
unaware of auth. On the **local DB** a request without a session acts as
the first owner (auto sign-in, on by default); on a **team DB** a session
is required and everyone shares the default workspace. Passwords are
scrypt hashes; sessions are stored as SHA-256 hashes and last 30 days
(sliding). The desktop keeps its session in the vault; the CLI keeps the
one from `agentic login` in `<dataDir>/cli/session.json` (0600).

## Security

The threat model, review results, and dependency policy are in
[`security.md`](security.md) (ADR 0014). In short: the renderer is
sandboxed behind a typed, sender-checked IPC contract and a strict CSP;
Core takes only loopback requests with the per-launch token from trusted
origins; secrets stay in the vault (Core holds a memory copy) and are
masked in logs, run events, and tool output; on a team DB every request
also needs a member's session (ADR 0015); anything an agent runs
(tools, CLI agents, chats) stays in scratch, run worktrees, or allowed
folders, with a filtered env and a deadline; CI audits production
dependencies.

## Packaging and release

ADR 0016, `docs/release.md`. electron-builder builds dmg + zip for arm64
and x64. `app.asar` holds the electron-vite output and only the runtime
`dependencies` (electron-updater, node-pty, ws, zod); everything else is
bundled. `Resources/postgres` carries the arch's Postgres binaries (main
passes it to `LocalPostgres` as `binDir`), and `Resources/cli` the
`agentic` bundle with its migrations, which "Install Command Line Tool…"
links. Fuses turn off RunAsNode, `NODE_OPTIONS`, and `--inspect`.
Local backups are offline snapshots of the cluster (`packages/local-postgres`
`snapshot.ts`, driven by main with Core and Postgres stopped). A `vX.Y.Z`
tag builds, signs and notarizes (once the secrets exist), and uploads to a
draft GitHub Release; electron-updater installs published releases on
quit. The first launch opens `/welcome`.

## Scalability

- Core handlers are stateless and all state lives in Postgres, so many app
  instances can share a team DB.
- The job queue uses `FOR UPDATE SKIP LOCKED` with leases and heartbeats.
  When an instance crashes, its runs are reclaimed after the lease expires.
- The `EventBus` interface is in-memory today. A Postgres `LISTEN/NOTIFY`
  adapter can be added when live views must cross instances.
- `agentic serve` runs the same Core headless. A dedicated worker or team
  server later is configuration, not a rewrite.
- Indexes on `(workspace_id, updated_at)`. Run and thread lists take a
  `limit` (newest first); run events replay from a `seq` cursor.
- Not built yet (Backlog): cursor pagination on list endpoints
  (`pageQuerySchema`/`pageSchema` exist in `contracts`) and retention jobs
  for `run_events` and checkpoints.

## Code conventions

- File names in kebab-case, named exports, no default exports except where
  a framework requires them.
- Errors: a typed `AppError { code, message, details, traceId? }`, mapped
  to one HTTP error shape. The renderer shows them with `showError`.
- Logging: `moduleLogger("<package>.<area>")`, fields first and message
  last; never `console.*` in packages, never CLI arguments or secrets.
- No `any`, and no `as` casts on boundary data. Parse with Zod instead.
- Comments explain **why**, not what.
- Prefer composition over configuration flags. Split a component before it
  needs a third mode.
