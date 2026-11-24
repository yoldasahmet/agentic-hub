# Roadmap — Agentic Hub

A macOS-first desktop app to **create agents**, **compose them into
workflows**, and use them from **chat, GitHub, and Jira**. Every run's state
is managed by a **local LangGraph server embedded in the app**.

- **Current focus:** Phase 18 → `P18.3` (blocked: needs the owner's Apple
  Developer ID; the setup is in `docs/release.md` → Signing and notarization
  setup). Every other step is done. Milestone E follows once releases are
  signed, notarized, and published where auto-update can read them.
- **Last updated:** 2026-11-24

**Read with:** [`docs/architecture.md`](docs/architecture.md) (how it fits
together) · [`docs/design-system.md`](docs/design-system.md) (UI and UX) ·
[`docs/reference-review.md`](docs/reference-review.md) (what we keep and fix
from the reference).

---

## How to use this file

- Steps use checkboxes: `- [ ]` = **todo**, `- [x]` = **done**. Phases use
  `todo` / `in progress` / `done` in the Status table.
- Work in order. A phase starts when the previous phase's **Exit** criteria
  are met.
- When a step is finished and verified:
  1. Tick it.
  2. Update the phase row (status + progress).
  3. Move **Current focus** and bump **Last updated**.
  4. Commit all of this together with the work.
- Don't tick a step whose checks were skipped or failing. Leave it todo and
  add an indented `- Blocked: …` line under it.
- If a step is implemented and passes every check the environment allows,
  but needs the owner's Mac (CLI sign-ins, API keys, signing), tick it and
  add an indented `- Verify on Mac: …` line saying what to check.
- Obsolete steps may be removed; say why in the commit message. New work
  gets the next free ID in the right phase, or goes to **Backlog**.

---

## Goals

1. **Agents.** Create and version agents. Edit their **inputs and
   outputs**, prompts, and model. Every agent has its own color and icon.
2. **Workflows.** Compose agents into graphs with branches, loops, parallel
   steps, human gates, and subworkflows, compiled to LangGraph.
3. **State.** Every run and chat is a thread on the embedded LangGraph
   server. Inspect, edit, resume, and fork it.
4. **Chat.** Pick a target (**App**, **Agent**, or **Workflow**). Chat asks
   for the target's inputs, runs it, and handles its human gates inline.
5. **Integrations.** GitHub and Jira, as UI and as agent tools and triggers.
6. **LLMs.** Claude Code, Codex, Gemini CLI, and OpenCode via their CLIs.
   OpenRouter via its API.
7. **Data.** A local Postgres service by default, or a remote team DB via a
   connection string.

**Not now:** Slack (later; see Backlog), Microsoft Teams, Windows/Linux
builds, and a hosted server.

## Key decisions

Details and rationale are in `docs/architecture.md`.

| # | Decision |
| --- | --- |
| D1 | **Electron + electron-vite.** Packaging (electron-builder) waits until all features are done (Phase 18). |
| D2 | **React 19, Vite, Tailwind, shadcn/Radix, TanStack Router + Query, Zustand (UI state only), React Flow**, with the Claude-light design system. |
| D3 | **Embedded core.** One modular-monolith backend (API + LangGraph runtime + jobs) runs inside the app as an Electron `utilityProcess`. The same entry point runs headless under Node. |
| D4 | **LangGraph.js** with the official `PostgresSaver` + `PostgresStore`. A threads/runs/state API shaped like LangGraph Platform. No duplicate checkpoint tables. |
| D5 | **Postgres as a local service** using bundled binaries managed by the app (**no Docker**, including in dev). Optional **remote team DB** via a connection string in Settings. |
| D6 | **LLM providers mirror the CLIs:** Claude Code, Codex, Gemini CLI, OpenCode. **OpenRouter uses its HTTP API.** One `LlmProvider` interface. |
| D7 | **Zod-first `packages/contracts`.** Types are inferred. Open sets are stored as `text`, never pg enums. |
| D8 | **Secrets** live in the Electron `safeStorage` vault (Keychain). The DB stores references only. |
| D9 | **Transport:** `127.0.0.1`, dynamic port, per-launch token. One typed client shared by the UI and the CLI. |
| D10 | Agents and workflows are **versioned documents** (an autosaved draft plus immutable published versions). Runs pin a version. |
| D11 | **Postgres job queue with leases** (`SKIP LOCKED`) for runs, schedules, and triggers, so it is safe on a shared team DB. |
| D12 | **Tooling:** pnpm + Turborepo, Biome, strict TS/ESM, dependency-cruiser layer rules. **Logging and tests are built from scratch in Milestone C.** |
| D13 | **Basic auth** (email + password, workspace membership) is implemented **last**. Until then the app runs as a single local user. |

---

## Status

| Phase | Name | Status | Progress |
| --- | --- | --- | --- |
| 0 | Planning | done | 7/7 |
| 1 | Monorepo & tooling | done | 6/6 |
| 2 | Desktop shell & design system | done | 8/8 |
| 3 | Database: local service + team DB | done | 6/6 |
| 4 | Embedded core & LangGraph server | done | 10/10 |
| 5 | LLM providers (CLI mirror + OpenRouter) | done | 8/8 |
| 6 | Agents | done | 9/9 |
| 7 | Workflows | done | 13/13 |
| 8 | Chat (App / Agent / Workflow) | done | 8/8 |
| 9 | Tools, MCP & skills | done | 4/4 |
| 10 | GitHub integration | done | 6/6 |
| 11 | Jira integration | done | 5/5 |
| 12 | CLI (`agentic`) | done | 4/4 |
| 13 | Logging (from scratch) | done | 4/4 |
| 14 | Testing (from scratch) | done | 6/6 |
| 15 | Security | done | 5/5 |
| 16 | Docs | done | 6/6 |
| 17 | Basic user auth (last feature) | done | 5/5 |
| 18 | macOS packaging & release (after all features) | in progress | 6/7 |

**Milestones**

- **A: MVP (end of Phase 7).** Build an agent, edit its I/O, wire it into a
  workflow, run it with a human gate, and inspect/edit/fork its state.
- **B: Integrated (end of Phase 12).** Chat targets, tools/MCP, GitHub, Jira,
  and the CLI all work end to end.
- **C: Production quality (end of Phase 16).** Logging and tests built from
  scratch, then security review and docs.
- **D: Feature complete (end of Phase 17).** Basic user auth.
- **E: Release (end of Phase 18).** A signed, notarized, auto-updating macOS
  app.

---

## Phase 0: Planning

- [x] **P0.1** Analyze the reference web app.
- [x] **P0.2** Write `ROADMAP.md`.
- [x] **P0.3** Write `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` with roadmap rules.
- [x] **P0.4** Architecture review of the reference → `docs/reference-review.md`.
- [x] **P0.5** Target architecture and refactor plan → `docs/architecture.md`.
- [x] **P0.6** Claude-light design system and UX principles → `docs/design-system.md`.
- [x] **P0.7** Owner confirms decisions D1–D13 (confirmed 2026-10-10, all as proposed).

## Phase 1: Monorepo & tooling

- [x] **P1.1** pnpm workspaces + Turborepo. Root scripts `dev`, `build`, `lint`, `check-types`. Pin Node 22 LTS and `packageManager`.
- [x] **P1.2** `packages/config`: strict ESM tsconfig bases, Biome presets.
- [x] **P1.3** `packages/contracts` skeleton: ids (UUIDv7), `AppError`, pagination, event envelope base (Zod-first).
- [x] **P1.4** Layer rules from `docs/architecture.md` enforced with dependency-cruiser, plus a 250-line file check.
- [x] **P1.5** GitHub Actions CI on `macos-latest`: install, lint, check-types, layer and file-size checks.
- [x] **P1.6** Fix source startup: install Electron 44 before development/preview launches and keep `pg-native` optional in the main/Core bundles.
  - Verified on Mac: `pnpm dev` and desktop `start` open on fresh profiles with the local database and Core ready; build, lint, type checks, and all eight desktop tests pass. A bundling regression test covers development and production modes.

**Exit:** a clean install passes all checks locally and in CI.

## Phase 2: Desktop shell & design system

- [x] **P2.1** `apps/desktop` via electron-vite (main / preload / renderer). `pnpm dev` opens a window.
  - Verify on Mac: `pnpm dev` opens the window (Electron downloads its binary on first launch).
- [x] **P2.2** Security baseline: `contextIsolation`, `sandbox`, no `nodeIntegration`, strict CSP, navigation guards.
- [x] **P2.3** Typed preload bridge (`window.app`) with Zod IPC contracts from `packages/contracts`.
- [x] **P2.4** `packages/ui` tokens: Claude-light neutrals (darker canvas), accent, status, 10-hue identity palette, self-hosted fonts.
- [x] **P2.5** shadcn primitives + first patterns: `EntityAvatar`/`EntityChip`, `StatusPill`, `EmptyState`, `CommandPalette` (⌘K).
- [x] **P2.6** App shell: sidebar (Chats, Agents, Workflows, Runs, Inbox, GitHub, Jira, Settings), title bar, status bar. TanStack Router + Query, Zustand.
- [x] **P2.7** macOS polish: `hiddenInset` title bar, native menu and shortcuts, window-state persistence, single-instance lock.
  - Verify on Mac: inset traffic lights sit in the 40px title bar, the app menu shows Settings (⌘,), and ⌘K/⌘N work from a focused text field.
- [x] **P2.8** Secrets vault in main (`safeStorage`), IPC to read and write, and a Settings → Secrets page.
  - Verify on Mac: `secrets.status` reports `keychain` and a saved secret survives a restart (checked on Linux with the dev-only plain-text backend).

**Exit:** the app opens in the Claude-light shell, ⌘K navigates, and secrets persist in the Keychain.

## Phase 3: Database (local service + team DB)

- [x] **P3.1** `packages/local-postgres`: bundled Postgres binaries, `initdb` into the app data dir, start/stop with the app, free port, health check. **No Docker**, including in dev.
  - Verify on Mac: first `pnpm dev` creates `~/Library/Application Support/Agentic/postgres/data`, the status bar shows `DB Local · 127.0.0.1:<port>`, and quitting leaves no `postgres` process (checked on Linux with the linux-x64 binaries).
- [x] **P3.2** `packages/db` connection manager with `local` and `remote` modes: pool, TLS, connection string read from the vault.
- [x] **P3.3** Schema v1 (see the architecture data model): `workspace_id` + `created_by` on every row, UUIDv7, indexes, no pg enums for open sets.
- [x] **P3.4** Migrations: `drizzle-kit generate`, applied on Core start under an advisory lock (safe on a shared DB).
  - Core applies them on start since P4.2 (ADR 0003).
- [x] **P3.5** Settings → Database: **Local / Remote** switch, **connection string** field, Test connection, Apply migrations, switch + restart Core. The status bar shows the active DB.
  - Verify on Mac: switch to a remote DB with `verify-full` TLS (e.g. a hosted Postgres) and back to Local. The switch restarts Core on the new DB (P4.2).
- [x] **P3.6** Bootstrap the default workspace and a single local user.

**Exit:** the app runs on the local service by default and switches to a remote DB from Settings.

## Phase 4: Embedded core & local LangGraph server

- [x] **P4.1** `packages/core`: Hono app, module layout (`routes → service → repository`), `AppError` mapping, `/health`.
- [x] **P4.2** Embed in Electron: main launches Core as a `utilityProcess`, passes DB config and secrets, and restarts it on crash. Core takes over the pool, migrations, and bootstrap from main's `DatabaseSupervisor` (ADR 0002). The same entry runs under Node.
  - Verify on Mac: `pnpm dev` shows `Core ready` in the status bar, Activity Monitor lists an "Agentic Core" helper, killing it brings Core back (status shows a restart), and quitting leaves no Core or `postgres` process (checked on Linux under xvfb).
- [x] **P4.3** Local transport: `127.0.0.1`, dynamic port, per-launch token, `0600` runtime file for the CLI.
- [x] **P4.4** `packages/client`: typed HTTP (Hono RPC) + WS client with reconnect and cursor replay.
- [x] **P4.5** `packages/graph`: `PostgresSaver` + `PostgresStore` on the active DB. Assistant registry (graph + pinned version).
- [x] **P4.6** Threads/runs/state API: create, stream, wait, cancel. State get, update (as node), and history.
- [x] **P4.7** Event pipeline: stream modes → `contracts` events → `run_events` (seq) → `EventBus` → WS.
- [x] **P4.8** Human-in-the-loop: `interrupt()` + `Command({ resume })`, and a pending-interrupts query that feeds the Inbox.
- [x] **P4.9** Job queue + scheduler in Postgres (leases, heartbeats): recover runs after a restart, cancel, concurrency limits.
  - The scheduler covers delayed jobs (`run_after`), retry backoff, and lease recovery. Trigger firing builds on it in P7.10, P10.6, and P11.5.
- [x] **P4.10** `StateInspector` UI: threads, checkpoint timeline, JSON view/edit, diff, fork.
  - Verify on Mac: Runs → run the sample graph, edit its state at the gate, fork from a checkpoint, quit and relaunch, then answer the gate from the Inbox (checked on Linux under xvfb with Playwright over CDP).

**Exit:** a sample graph runs, interrupts, survives an app restart, resumes, and has its state edited and forked in the UI.

## Phase 5: LLM providers (CLI mirror + OpenRouter)

- [x] **P5.1** `packages/cli-bridge`: the one process layer (spawn, cwd validation, env redaction, cancel, PTY fallback).
  - Verify on Mac: launched from Finder, Settings → Providers finds CLIs installed via Homebrew/npm (login-shell PATH). The PTY fallback is wired into chat in P8.7.
- [x] **P5.2** Stream parsers, one file each: **Claude Code, Codex, Gemini CLI, OpenCode** → normalized `LlmEvent`s.
  - Verify on Mac: with `codex`, `gemini`, and `opencode` installed and signed in, Settings → Providers → Test streams text and shows usage for each (Claude Code was checked live here; the other three on fixtures from their docs, ADR 0004).
- [x] **P5.3** **OpenRouter** provider over its HTTP API: streaming, tool calls, structured output, key in the vault.
  - Verify on Mac: with a real key, Sync models, then Test a synced model with and without structured output (openrouter.ai is blocked here; checked against a local stand-in via `AGENTIC_OPENROUTER_BASE_URL`).
- [x] **P5.4** `packages/llm`: `LlmProvider` interface + registry, capability flags, catalog as data (`config/llm-catalog.json` + OpenRouter model sync).
- [x] **P5.5** Structured output: the native schema option where available, else extract + validate + retry.
- [x] **P5.6** Settings → Providers: detected CLIs (version, sign-in status), OpenRouter key, enable models, "Test" prompt.
  - Verify on Mac: each installed CLI shows its version and Ready/Signed out correctly; signing out of one and pressing Detect again updates it.
- [x] **P5.7** Usage and cost per call. Multi-model fan-out and compare.
- [x] **P5.8** Refresh the Codex model choices from the CLI catalog with GPT-5.6 Sol, Terra, and Luna.

**Exit:** one prompt streams through all four CLIs and OpenRouter via one interface.

## Phase 6: Agents

- [x] **P6.1** Agent model + CRUD: kinds `llm` / `tool` / `human`; identity (name, color, icon); autosaved draft; immutable published versions.
  - Agents resolve on demand through an `AssistantSource` (`agent:<id>` pinned versions, `agent-draft:<id>` with the draft snapshot in the run input), so a team DB needs no registration broadcast (ADR 0005). Archive replaces delete, since runs reference versions.
- [x] **P6.2** Shared `SchemaEditor` + `SchemaForm`: I/O field builder ↔ JSON Schema (port `io-schema.ts`).
  - `x-ui-order` keeps field order, because `jsonb` re-sorts keys; `x-ui-*` keywords are stripped before a schema reaches a provider.
- [x] **P6.3** Prompt editor: system prompt + template with `{{input.x}}` autocomplete and a live preview.
- [x] **P6.4** Runtime config: `ModelPicker`, reasoning, fallback chain, working-dir policy, tool/MCP/skill slots.
  - The slots hold names; P9 resolves them against the tool, MCP, and skill registries.
- [x] **P6.5** `packages/agents`: version → LangGraph node. Render, call, validate output, repair. **No role-specific code.**
  - The `tool` kind calls a `ToolInvoker`; until P9.1 Core's invoker has no tools and says so.
- [x] **P6.6** `OutputView` renderer registry by format: markdown, json, plan, diff, html, table.
- [x] **P6.7** Agent playground: `SchemaForm` inputs, live `EventStream`, edit output, save test inputs.
  - Verify on Mac: run one agent on Claude Code and on OpenRouter with a real key, and on Codex/Gemini/OpenCode where installed (checked here on Claude Code live and OpenRouter through a local stand-in via `AGENTIC_OPENROUTER_BASE_URL`).
- [x] **P6.8** Library: import/export (JSON/YAML), duplicate. Built-ins as data: Planner, Coder, Reviewer, Tester, PR Summarizer, Jira Triager.
  - Verify on Mac: Export as JSON/YAML opens the save dialog and the saved file imports back (export content and import were checked here; the native dialog can't be driven under xvfb).
- [x] **P6.9** Open or restore one installed agent per built-in slug and keep archived agents resolvable in existing workflow nodes.

**Exit:** create an agent in the UI, edit its inputs and outputs, and run it on two providers in the playground.

## Phase 7: Workflows

- [x] **P7.1** Workflow model + CRUD: one versioned document (nodes `agent` / `workflow` / `gate`, edges, I/O), identity color, revision lock.
  - Publishing pins every `latest` reference; draft runs pin a snapshot per revision in `workflow_snapshots` (ADR 0006). Referenced agents and subworkflows must be published.
- [x] **P7.2** `WorkflowCanvas` (React Flow): palette, nodes colored by agent, inspector, minimap, auto-layout, undo/redo.
- [x] **P7.3** Bindings and output mapping (port bindings + JSON-logic) with a visual picker. No raw JSON needed.
  - Expressions (JSON-logic) are the optional advanced path; conditions use a row builder.
- [x] **P7.4** Control flow: conditions, loops with `maxIterations`, parallel fan-out/join, subworkflows.
  - Joins are deferred LangGraph nodes; loop edges compare the target's run count; subworkflows run as subgraphs whose gates pause the parent.
- [x] **P7.5** Live `ValidationPanel` (port the reference issue codes).
- [x] **P7.6** `packages/workflows` compiler → `StateGraph`. Publishing registers an assistant version.
- [x] **P7.7** Run launcher (`SchemaForm`) + live run canvas: node status, edge highlights.
  - Verify on Mac: run the PR review template on Claude Code from the UI and watch both agents run in parallel on the canvas (checked here live through headless Core; the app's unprivileged test user under xvfb had no signed-in `claude`).
- [x] **P7.8** Gates: approve, reject, edit input, edit output via `SchemaForm`. Inbox, dock badge, macOS notification.
  - Verify on Mac: a new gate while the window is in the background shows a notification (click focuses the app) and the Dock badge counts waiting gates (the IPC call was checked here; Linux has no Dock).
- [x] **P7.9** Retry from node, fork from checkpoint, compare two runs.
- [x] **P7.10** Templates as data (SDLC, PR review, issue triage). Manual and scheduled triggers.
  - Templates are JSON bundles in `packages/workflows/templates/`. Schedules use cron + time zone and fire once across instances through the job queue.
- [x] **P7.11** Port the reference SDLC pipeline: plan → design → code + PR → review/test loops back to the coder → merge and deploy, with its `sdlc-*` agents, skills, and the Figma MCP server. Bundles carry skills and MCP servers (servers install disabled); new `github.pr.merge` tool.
  - The `sdlc-*` agents are also in **Agents → Library**; adding one adds the built-in skills it names (`packages/agents/builtins/skills/`). Reference `github`/`filesystem` MCP servers map to the built-in `github.*`/`fs.*` tools. `templates.test.ts` validates every template; `templates-run.test.ts` drives the SDLC loops on the fake provider.
  - Verify on Mac: install **SDLC pipeline**, run it on a test repo with Claude Code and GitHub connected, approve the Coder/Tester/Deployer asks, and see the PR open, get e2e tests pushed, and merge. Enable `figma` with Figma desktop's Dev Mode MCP server on and add it to SDLC Designer.
- [x] **P7.12** Add the Marketing Campaign Draft template and its strategist, copywriter, and editor agents. Verified template installation in Electron and a sample run through OpenCode.
- [x] **P7.13** Run Marketing Campaign Draft and the SDLC pipeline on GPT-6 Luna with example inputs, approval gates and verified outputs.
  - Verified three marketing nodes and six SDLC nodes on Codex GPT-6 Luna in Electron. The SDLC deploy step resumed from its checkpoint and merged the example PR through a local GitHub API stand-in. All three tests passed from a fresh clone of the merged branch. The example has no deployment runbook.

**Exit:** Milestone A.

## Phase 8: Chat (App / Agent / Workflow)

- [x] **P8.1** Chat CRUD and layout: chat list · conversation · context panel.
  - Verify on Mac: create, rename (`/title`), archive, and delete chats; resize and collapse the list and context panel (CRUD checked here through headless Core; the UI was built and type-checked but not driven).
- [x] **P8.2** Target picker on a new chat: **App**, **Agent**, or **Workflow**, as colored chips. Switch with ⌘K or `@mention`.
  - Verify on Mac: ⌘N shows the chips (drafts disabled), `@` and ⌘K switch the target of an open chat, and ⌘K outside a chat starts one.
- [x] **P8.3** `packages/chat` orchestrator graph (intake → ask → execute → respond). Each chat is a thread.
  - One built-in `chat` assistant; targets are data in each run's context, and targets run as subgraphs inside `execute` (ADR 0007).
- [x] **P8.4** **App** target: a general assistant on the chosen model, with app tools (find and run agents and workflows, read GitHub/Jira items).
  - `find` and `run` work (checked live on Claude Code, including a hand-off to a workflow and its gate); GitHub/Jira read tools register as `AppTool`s in P10.4 and P11.4.
- [x] **P8.5** **Agent** target: extract inputs from the message, ask for missing required inputs via an inline `SchemaForm` card, run, render the output, refine on follow-ups.
  - Checked live on Claude Code through headless Core: extraction, the card answered by message and by form, cancel, and a refining follow-up.
  - Verify on Mac: the inputs card renders inline and ⌘↵ submits it.
- [x] **P8.6** **Workflow** target: the same intake for workflow inputs, inline node progress, gates answered in chat.
  - Checked live through headless Core: the gate interrupts the chat run and resumes with edited data; sending during a gate is refused with a hint.
  - Verify on Mac: node pills update live and the gate card answers in the chat.
- [x] **P8.7** Composer: files/images, GitHub/Jira item attachments, slash commands, working dir. Terminal mode (PTY) for interactive CLI sessions.
  - GitHub/Jira items are references until P10/P11 fetch their content. The PTY was checked here with node-pty; the xterm view was not driven.
  - Verify on Mac: attach files from the picker and by drag and drop, `/cwd` and Browse set the working dir, and terminal mode runs `claude` interactively in it.
- [x] **P8.8** Context panel (target, model, usage/cost, git status), reconnect replay, virtualized long chats.
  - Git status parsing was checked here; replay is the run-events replay on subscribe.
  - Verify on Mac: reload mid-answer and the stream continues; a chat with hundreds of messages scrolls smoothly.

**Exit:** pick a workflow in chat, answer its input questions, approve its gate in chat, and get the result.

## Phase 9: Tools, MCP & skills

- [x] **P9.1** `packages/tools` registry: shell, fs, git, http. Permission levels (read / write / dangerous) and a per-agent approval policy.
  - Backs the `tool` agent kind and resolves the agents' tool/MCP/skill slots per run workspace; approvals are `tool.approval` interrupts asked before any model or tool call (ADR 0008). `llm` agents use the fenced `tool` block loop.
  - Verify on Mac: an agent with `fs.write` set to "Ask first" shows the approval card in the Inbox and in a chat, and Approve/Reject behave (checked here through headless Core).
- [x] **P9.2** MCP client: stdio + streamable HTTP, tool discovery, attach to agents and pass to CLI providers.
  - Claude Code runs attached servers itself (`--mcp-config`, `--allowedTools` = granted tools), Codex via `-c mcp_servers.*`; others call them through the app. Secrets are `mcp.*` vault names. Checked live on Claude Code with a stdio server; streamable HTTP was type-checked only.
  - Verify on Mac: add a remote (HTTP) MCP server in Settings → MCP servers, Test lists its tools, and a Codex agent can call one.
- [x] **P9.3** Skills: inline and directory skills, attachable to agents and CLI sessions.
  - Terminal sessions take servers and skills from the Attach popover (Claude Code: `--append-system-prompt`).
  - Verify on Mac: Settings → Skills add/preview a folder skill, and a terminal session started with it follows it.
- [x] **P9.4** Guardrails: working-dir allowlist, secret redaction, timeouts, output size limits.
  - Settings → Tools: allowed folders (tools run only there or in scratch), per-call timeout, output limit. Secrets and token shapes are masked in tool results and agent output.

## Phase 10: GitHub integration

- [x] **P10.1** Auth: OAuth device flow or fine-grained PAT, stored in the vault. Detect an existing `gh auth`.
  - The vault token (`github.token`) wins, else `gh auth token` is read on demand. Device sign-in runs in Core and hands the token to main for the vault (ADR 0009); it needs an OAuth app client id in Settings → GitHub. Checked against a local GitHub stand-in.
  - Verify on Mac: save a fine-grained PAT and see "Signed in as …"; remove it with `gh auth login` done and see the gh source; register an OAuth app with device flow, sign in with the code, and find `github.token` in Settings → Secrets.
- [x] **P10.2** `packages/integrations/github`: Octokit client, pagination, rate-limit backoff.
  - Throttling (waits up to a minute) and retry plugins; Link-header pages; errors mapped to app codes. Rate-limit backoff checked against a stand-in returning 403 + `x-ratelimit-remaining: 0`.
- [x] **P10.3** UI: repos, issues and PRs (list/detail), `DiffViewer`, comments, create PR, reviews.
  - Verify on Mac: GitHub page lists your repos in the picker, opens an issue and a PR, posts a comment, adds line comments from Files changed to a review and submits it, and opens a PR from a branch (the UI was type-checked and built, not driven).
- [x] **P10.4** Agent tools: read files, search code, branch, commit, open PR, comment, review. Writes need approval.
  - `github.*` reads are `read`; branch, push, PR, comment, review are `write` (asked by default). Commits are local (`git.commit`); `github.pr.create` pushes the working dir's branch first. The chat App gets `github_issue`, `github_pull`, `github_issues`.
- [x] **P10.5** Local git: clone, one worktree per run, status/diff in the context panel.
  - The `worktree` working-dir policy: `owner/name` is cloned (blobless) into the data dir, a local repo must be in an allowed folder; branch `agentic/run-<id>`, shared by the run's nodes. The token reaches git via env config only. Checked with a local repo: shared worktree, commit, push, PR through a stand-in.
  - Verify on Mac: an agent with "Worktree per run" on `owner/name` clones over HTTPS with the saved token, and a chat's context panel "View diff" shows its working dir changes.
- [x] **P10.6** Triggers: poll issues, labels, and review requests → start a workflow (leased jobs).
  - `github` triggers are claimed with the schedules (`SKIP LOCKED`) and polled by `trigger.github.poll` jobs; the cursor is saved before runs start, and the first poll is a baseline. Template `github-issue-to-pr` with built-ins `issue-coder`, `git-committer`, `pr-opener`.
  - Verify on Mac: add a trigger "An issue gets a label" on a test repo to the GitHub issue to PR template, label an issue, approve the PR step in the Inbox, and see the PR on GitHub (the poll, commit, push, and PR were checked against a stand-in; Postgres can't run as root here, so headless Core wasn't started).

**Exit:** the SDLC template takes a GitHub issue and opens a PR.

## Phase 11: Jira integration

- [x] **P11.1** Auth: Jira Cloud email + API token in the vault, with a connection test.
  - Site and email are the workspace setting `jira:settings`; the token is the vault entry `jira.token` (ADR 0010). Settings → Jira tests a site, email, and token before saving. Checked against a local Jira stand-in (signed-in user, wrong token → `jira.unauthorized`).
  - Verify on Mac: in Settings → Jira, enter your `*.atlassian.net` site, email, and an API token, see "Connected as …" on Test and "Signed in as …" after Save, and find `jira.token` in Settings → Secrets.
- [x] **P11.2** `packages/integrations/jira`: REST v3 client, ADF ↔ Markdown.
  - `fetch` client with Zod-parsed responses, `Retry-After` backoff on 429/503, errors mapped to app codes; enhanced `POST /search/jql` paging. ADF ↔ Markdown round-trips headings, marks, links, nested lists, quotes, code, and rules (checked with a script and the stand-in).
- [x] **P11.3** UI: projects, JQL search, issue detail, transitions, comments, create issue.
  - Jira page: project picker, JQL bar, issue list, detail (description, sub-tasks, linked PRs, transition menu, comments), and New issue (sub-tasks take a parent key). The GitHub PR view shows the Jira keys it names.
  - Verify on Mac: the Jira page lists a project's open issues, a custom JQL search works, an issue's transition menu moves it, a comment posts, and New issue creates a task and a sub-task (the UI was type-checked and built, not driven).
- [x] **P11.4** Agent tools: get/search, comment, transition, create sub-tasks, link PRs.
  - `jira.issue.get`, `jira.search`, `jira.projects.list` are `read`; `jira.comment`, `jira.transition` (name, target status, or id), `jira.issue.create`, `jira.subtask.create`, `jira.link` are `write`. Tools now get the run's `workspaceId`. The chat App gets `jira_issue` and `jira_search`.
- [x] **P11.5** Triggers: JQL polling → workflow. Auto-link Jira keys ↔ GitHub branches/PRs.
  - `jira` triggers are claimed with the schedules and polled by `trigger.jira.poll` jobs; seen keys are saved before runs start and the first poll is a baseline. Opened PRs are linked (remote link, PR URL as `globalId`) on the keys their branch, title, or body name. Template `jira-issue-to-pr` with built-in `jira-pr-linker`.
  - Verify on Mac: add a Jira trigger (`project = ABC AND labels = agent`, issue → `issue`, key → `key`, repo input set) to the Jira issue to PR template, label an issue, approve the PR and link steps in the Inbox, and see the PR under the issue's links in Jira (poll, baseline, dedupe, and linking were checked against a stand-in; Postgres can't run as root here, so headless Core wasn't started).

**Exit:** a Jira ticket runs through the SDLC workflow and the resulting PR is linked back on the ticket.

## Phase 12: CLI (`agentic`)

- [x] **P12.1** `apps/cli` on `packages/client`. Finds the running app via the runtime file.
  - Verify on Mac: with the app open, `agentic status` finds `~/Library/Application Support/Agentic/runtime/core.json`.
- [x] **P12.2** Commands: `status`, `doctor`, `agents list|run`, `workflows list|run|resume`, `runs logs --follow`, `threads state get|set`.
  - Verify on Mac: against the real Core, run an agent, a workflow to its gate, `resume --approve`, `runs logs --follow`, and `threads state set`.
- [x] **P12.3** `agentic serve`: run Core headless under Node (scripts, CI, future worker).
  - Verify on Mac: `AGENTIC_DATABASE_URL=… agentic serve`, then `agentic status` in another terminal.
- [x] **P12.4** "Install CLI" menu item (symlink into `PATH`).
  - Verify on Mac: Agentic Hub → Install Command Line Tool… links `/usr/local/bin/agentic` (or `~/.local/bin`), and `agentic doctor` passes in a new terminal.

**Exit:** Milestone B.

## Phase 13: Logging (from scratch)

- [x] **P13.1** `packages/logger`: pino structured logs, levels, child loggers with `runId`/`threadId`/`traceId`, secret redaction.
- [x] **P13.2** Wire it into main, Core, cli-bridge, and graph. Rotating files in `~/Library/Logs/Agentic Hub`.
  - Verify on Mac: launch the app; `main.log` and `core.log` appear in `~/Library/Logs/Agentic Hub`, a chat or workflow run writes `run running` → `run succeeded` lines with its `runId`, and no token or DB password shows up (`grep -i` for a vault value).
- [x] **P13.3** In-app log viewer (filter by level, module, run) and a "Copy diagnostics" bundle.
  - Verify on Mac: Settings → Logs lists both processes live; level/module/search filters and the run/trace pins work; "Copy diagnostics" pastes redacted JSON without Core's token; "Open folder" opens Finder.
- [x] **P13.4** Error UX: error boundaries and actionable toasts linking to logs. Optional OTel/LangSmith export.
  - Verify on Mac: a failing action (e.g. a bad GitHub token test) toasts with "View logs" landing on that request's trace; a page that throws shows the error panel inside the shell. LangSmith works via `LANGSMITH_TRACING`/`LANGSMITH_API_KEY` in the environment (ADR 0012); OTel export is in the Backlog.

## Phase 14: Testing (from scratch)

- [x] **P14.1** Vitest workspace, coverage, and a CI job. Tests use an ephemeral local Postgres service.
- [x] **P14.2** Unit tests: contracts, bindings, JSON-logic, validation, compiler, schema ↔ fields.
- [x] **P14.3** Provider tests: CLI parsers on recorded fixtures, OpenRouter with mocked HTTP.
  - Verify on Mac: record real `claude`/`codex`/`gemini`/`opencode` streams and diff them against the fixtures when a CLI updates.
- [x] **P14.4** Core integration tests: modules, job queue + leases, migrations, event replay.
- [x] **P14.5** UI component tests: `SchemaForm`, `EventStream`, `WorkflowCanvas`.
- [x] **P14.6** E2E (Playwright for Electron): agent → workflow → chat run → gate → result.
  - Verified on Mac: both Electron E2E tests pass, including onboarding, selecting the published workflow in chat, answering the human agent, approving the gate and receiving the result.

## Phase 15: Security

- [x] **P15.1** Threat model and review: IPC surface, localhost token, CSP, renderer isolation.
  - Verify on Mac: the packaged renderer still reaches Core (its `Origin` is `file://` or `null`, both trusted); a page in Safari can't open `ws://127.0.0.1:<port>/ws` (403).
- [x] **P15.2** Secrets audit: vault-only storage, redaction in logs/events/UI, TLS for the remote DB.
  - Verify on Mac: a run whose model echoes a vault value shows `[redacted]` in the run page and `run_events`; a team DB with a valid certificate connects under `verify-full`.
- [x] **P15.3** Execution safety: working-dir allowlist, tool approvals, CLI env, timeouts.
  - Verify on Mac: picking a chat folder outside Settings → Tools → Allowed folders toasts `tool.dir_denied` with the fix; after adding it, a Claude Code agent runs there.
- [x] **P15.4** Dependency audit and an update policy in CI.
- [x] **P15.5** Prepare credentials and dependencies for the public source release. Keep Codex MCP credentials out of process arguments, scope GitHub CLI logins to the API host, and scan the source and Git history. The source scan and production dependency audit were clean. The two historical scanner matches are documented test fixtures.

## Phase 16: Docs

- [x] **P16.1** User guide: agents, workflows, chat targets, integrations, team DB.
  - Verify on Mac: walk `docs/user-guide/` against the running app (labels, menus, and flows were checked against the code, not the GUI).
- [x] **P16.2** Architecture docs and ADRs (`docs/adr/`) synced to the code.
- [x] **P16.3** Contributor guide: setup, conventions, adding a provider, integration, or tool.
- [x] **P16.4** Add the MIT license, provider setup, two example workflow inputs and a ten-image gallery from Electron. Include the project license in the packaged app.
- [x] **P16.5** Rename the desktop app and repository to Agentic Hub and refresh the ten-image full-screen gallery with Jira-to-SDLC chat, agent configuration and runs, and SDLC execution.
- [x] **P16.6** Prepare Agentic Hub for release under a new account. Use an account-independent bundle ID and release configuration, document private vulnerability reporting, and verify fresh Git history without any prior remote.

**Exit:** Milestone C.

## Phase 17: Basic user auth (last feature)

- [x] **P17.1** `users` + `workspace_members` (owner/member). Password hashing with scrypt (`node:crypto`). No external IdP.
  - Migration 0005 adds `users.password_hash`, `workspace_members` (backfilled: creators own their workspaces), and `auth_sessions` (token hashes). The first sign-up claims the bootstrap local user (ADR 0015).
- [x] **P17.2** Sign-up/sign-in screens. Session token in the vault. Core middleware replaces the single local user.
  - Verify on Mac: on a team DB the app opens on **Create your account** / **Sign in**; after sign-in it opens the app, the session survives a restart (Keychain), and **Settings → Account → Sign out** returns to the sign-in screen.
- [x] **P17.3** Local DB: optional auto sign-in. Remote team DB: sign-in required, shared workspace.
  - Verify on Mac: on the local DB the app opens without a sign-in; **Settings → Account** creates an account, then turning off **Sign in automatically** shows the sign-in screen on the next launch.
- [x] **P17.4** `agentic login` for the CLI.
  - Also `agentic logout`, `AGENTIC_SESSION`, and the user in `agentic status`. Smoke-tested against a headless Core on a team DB.
- [x] **P17.5** Tests and security review for auth.
  - `docs/security.md` → T9 and Review results (Phase 17). Fixed in review: CORS allowed headers missed the session header; expired sessions were never deleted.

**Exit:** Milestone D.

## Phase 18: macOS packaging & release (after all features)

- [x] **P18.1** electron-builder: dmg + zip for arm64 + x64, app icon, native modules (node-pty) rebuilt for Electron, Electron fuses (RunAsNode and Node options off, ASAR integrity on; see `docs/security.md`).
  - `apps/desktop/electron-builder.yml` (ADR 0016). node-pty isn't rebuilt: its N-API prebuilds cover both archs, unpacked from `app.asar`. Only runtime `dependencies` ship; the rest is bundled. A CI `package` job builds an unpacked Linux app and runs `scripts/check-package.mjs` (archive contents, fuses, Postgres, CLI); checked the same way here.
  - Verify on Mac: `pnpm --filter @agentic/desktop package --mac --arm64 --publish never`, then the smoke check on `release/mac-arm64/Agentic Hub.app`; the app opens (right-click → Open while unsigned) with the new icon, and a chat's terminal mode works (node-pty from the archive).
- [x] **P18.2** Bundle the Postgres binaries per arch. Backup/export of the local DB.
  - `Resources/postgres` from `@embedded-postgres/darwin-<arch>`. The binaries have no `pg_dump`, so Settings → Database → Back up/Restore use offline cluster snapshots (`snapshot.ts`): version check, password reset in single-user mode, rollback if the restored cluster doesn't start. Unit tests with real `tar`; the password reset on a real cluster.
  - Verify on Mac: the packaged app creates `postgres/data` from `Contents/Resources/postgres`; Back up… saves a `.tar.gz`; after adding an agent, Restore… brings back the backup's state and leaves `postgres/data.before-restore`.
- [ ] **P18.3** Signing and notarization: Developer ID, hardened runtime, entitlements, `notarytool`.
  - Hardened runtime, `build/entitlements.mac.plist`, and the workflow's signing and notarization steps are in place and turn on when their secrets exist (`docs/release.md`).
  - Blocked: needs the owner's Apple Developer ID. Create a **Developer ID Application** certificate and export it with its key as `.p12`; create an **App Store Connect API key** (Developer role, `.p8`). Add the repo secrets `MAC_CERTIFICATE_P12_BASE64` (`base64 -i cert.p12`), `MAC_CERTIFICATE_PASSWORD`, `APPLE_API_KEY_P8_BASE64` (`base64 -i AuthKey_….p8`), `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`. Then run Actions → Release → Run workflow and check `codesign --verify --deep --strict`, `spctl --assess`, and `xcrun stapler validate` on the app.
- [x] **P18.4** Auto-update via electron-updater + GitHub Releases.
  - `main/updater.ts`: checks at launch and every 6 h, downloads in the background, installs on quit; Agentic Hub → Check for Updates…. `latest-mac.yml` is published with each release.
  - Verify on Mac: needs P18.3 (Squirrel.Mac installs signed updates only) and a feed the app can read without a token: make this repo public or set `RELEASES_REPO` to a public `owner/name` and configure `RELEASES_TOKEN` (`docs/release.md`). Then install vN, publish vN+1, and see it install on quit.
- [x] **P18.5** Release workflow on macOS runners, semver, changelog.
  - `.github/workflows/release.yml`: a `vX.Y.Z` tag checks versions and `CHANGELOG.md` (`scripts/release.mjs`), lints, builds both archs on one runner, smoke-checks, and uploads to a draft release; "Run workflow" is an unsigned dry run kept as an artifact.
  - The dry run passed on `macos-latest` (Release run #1, 2026-10-12): unsigned dmg + zip for arm64 and x64, and the smoke check on the arm64 app.
  - Verify on Mac: after P18.3, `node scripts/release.mjs version 0.1.0`, tag `v0.1.0`, and publish the draft.
- [x] **P18.6** First-run onboarding: DB init, detect CLIs, OpenRouter key, connect GitHub/Jira, install templates.
  - `/welcome` on the first launch (database state, detected CLIs + OpenRouter key, GitHub/Jira status with links, starter workflows), until finished or skipped; Settings → General reopens it. The E2E flow still starts from ⌘N.
  - Verify on Mac: a fresh profile opens on Welcome to Agentic Hub, Detect again and Add on a template work, Start a chat lands on New chat, and the next launch opens Chats.
- [x] **P18.7** Bundle the `agentic` CLI as a self-contained script at `resources/cli/agentic` (no tsx), so "Install Command Line Tool…" works in packaged builds.
  - `apps/cli/scripts/bundle.mjs` (esbuild): a CommonJS launcher (checks Node 22+) + `agentic.mjs` + `migrations/`. It runs on the user's Node, since the RunAsNode fuse is off (ADR 0016). An integration test runs the bundle through a symlink and `agentic serve` on a real Postgres.
  - Verify on Mac: in the packaged app, Install Command Line Tool… links `Contents/Resources/cli/agentic`, and `agentic doctor` and `agentic status` work in a new terminal.

**Exit:** Milestone E.

---

## Backlog (unscheduled)

- **Slack** integration (planned later): trigger workflows and answer gates from Slack.
- Dark theme (tokens are ready for it).
- Postgres `LISTEN/NOTIFY` event bus for cross-instance live views.
- Dedicated worker / team server built on `agentic serve`.
- RAG/memory over repos and docs (pgvector).
- Linear and GitLab integrations.
- Cost budgets and alerts per workflow.
- Cleanup of run worktrees and clones under `<data>/git` (age or finished runs).
- GitHub and Jira webhooks through a relay, for instant triggers instead of polling.
- Jira OAuth (3LO) sign-in as an alternative to API tokens.
- Windows and Linux builds.
- A coverage threshold in CI once the suite settles (Phase 14 reports coverage only).
- More E2E flows (GitHub/Jira against stand-ins, team DB switching) after the first one runs in CI.
- OpenTelemetry log/trace export and a LangSmith key in Settings (vault-backed) instead of env vars (ADR 0012).
- Redact secrets across streamed `message.delta` chunks (today each chunk is scrubbed alone; see `docs/security.md` → Residual risks).
- "View logs" links from run pages (filter by `runId`) and trace ids in `agentic` CLI errors.
- Cursor pagination on list endpoints (`pageSchema` in contracts is unused; lists take a `limit` today).
- Retention jobs for `run_events` and old checkpoints.
- Password change and reset (an owner-issued reset link or code), and a list of your sessions with "sign out everywhere" (ADR 0015).
- Invites and several workspaces per database (today everyone joins the default workspace).
- A logical (SQL) export of the local database to load into a team DB. The bundled binaries have no `pg_dump`, so P18.2 backups are cluster snapshots.
- Optional passphrase encryption for local database backups.
