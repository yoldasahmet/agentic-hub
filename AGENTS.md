# AGENTS.md

Orientation for coding agents (Claude Code, Codex, Gemini CLI, OpenCode, …)
working in this repo. Optimize for focused reads and small, type-safe,
easy-to-read changes.

## ⚠️ Roadmap first: required for every task

`ROADMAP.md` is the source of truth for scope, order, and progress.

1. **Before starting any task**, read `ROADMAP.md`: the **Current focus**
   line, the **Status** table, and the phase you'll touch.
2. If the user doesn't name a task, work on the **next todo step**. If they
   ask for something off-roadmap, do it, then add it as a step in the right
   phase (or in **Backlog**).
3. **When you finish a step** and its verification passes:
   - change `- [ ]` to `- [x]`,
   - update that phase's row in the Status table (status + `done/total`),
   - move **Current focus** to the next todo step and bump **Last updated**,
   - commit the roadmap update **together with the work**.
4. Never tick a step whose checks were skipped or failing. Leave it todo and
   add an indented `- Blocked: <reason>` line under it. **Exception:** if
   the step passes every check this environment allows but needs the
   owner's Mac (CLI sign-ins, API keys, GUI, signing), tick it and add an
   indented `- Verify on Mac: <what to check>` line.
5. If you change a decision in **Key decisions** (D1–D13), update the table
   and `docs/architecture.md`. For significant changes, also add an ADR in
   `docs/adr/`.
6. You may delete obsolete steps. Say why in the commit message.
7. Respect the order the owner chose. Tests and logging are built in
   Phases 13–14, auth in Phase 17, and macOS packaging in Phase 18, after
   all features. Don't pull them earlier unless asked.

## Repository scope

All edits, branches, commits, and pull requests belong in this checkout.
The historical reference web app is read-only. Its review notes are in
`docs/reference-review.md`.

## Read before coding

| Doc | Read when |
| --- | --- |
| `ROADMAP.md` | Every task |
| `docs/architecture.md` | Adding a package or module, crossing a layer, touching data or runtime |
| `docs/design-system.md` | Any UI work. Check its **component catalog** before creating a component. |
| `docs/reference-review.md` | Porting from the reference repo |
| `docs/security.md` | Touching IPC, Core's HTTP/WS boundary, secrets, process spawning, or dependencies |
| `docs/autonomous-run.md` | Running a phase in an unattended cloud session |
| `CONTRIBUTING.md` | Adding a provider, tool, integration, or template |
| `docs/user-guide/` | Changing user-visible behavior (update the matching page) |
| `docs/adr/README.md` | Writing or amending an ADR |
| `docs/release.md` | Packaging, signing, releasing, or auto-update |

## Project snapshot

- **What:** a macOS-first Electron app to create agents, compose workflows,
  and chat with an App, Agent, or Workflow target. State lives on an
  **embedded local LangGraph server**. GitHub and Jira integrations. LLMs via
  the Claude Code, Codex, Gemini, and OpenCode CLIs, plus the OpenRouter API.
  An `agentic` CLI.
- **Stack:** TypeScript (strict, ESM), Electron + electron-vite, React 19,
  Tailwind + shadcn/ui, React Flow, Hono, LangGraph.js, PostgreSQL (local
  service or remote team DB) + Drizzle, Zod, pnpm + Turborepo, Biome.
- **State:** in progress (see the Status table in `ROADMAP.md`). The layout
  below is the **target**; create each path when its phase lands, and add
  new packages to the layer map in `.dependency-cruiser.cjs`.

## Zones (target layout)

Dependencies point **down the layers only** (see `docs/architecture.md`).

| Layer | Path | Owns |
| --- | --- | --- |
| 0 | `packages/contracts` | Zod schemas + inferred types: entities, DTOs, events, IPC |
| 0 | `packages/logger` | pino logs: rotating files, redaction, run/trace context (ADR 0012) |
| 1 | `packages/db` | Drizzle schema per module, migrations, local/remote connection |
| 1 | `packages/local-postgres` | Bundled Postgres service lifecycle |
| 1 | `packages/cli-bridge` | The only place that spawns CLIs: process, PTY, stream parsers |
| 2 | `packages/llm` | `LlmProvider` registry: Claude Code, Codex, Gemini, OpenCode (CLI) + OpenRouter (API) |
| 2 | `packages/tools` | Tool registry, permissions, approvals, MCP, skills |
| 2 | `packages/graph` | LangGraph host: saver/store, threads, runs, events, interrupts, job queue |
| 3 | `packages/integrations` | `github/`, `jira/`: clients, tools, triggers |
| 3 | `packages/agents` | Agent version → LangGraph node |
| 4 | `packages/workflows` | Bindings, JSON-logic, validation, compiler, template importer |
| 4 | `packages/chat` | Chat orchestrator graphs (App / Agent / Workflow targets) |
| 5 | `packages/core` | Embedded backend: Hono app, `modules/<feature>/{routes,service,repository}.ts` |
| 6 | `packages/client` | Typed HTTP + WS client (renderer and CLI) |
| 6 | `packages/ui` | Tokens, shadcn primitives, patterns, feature components |
| app | `apps/desktop` | Electron main (vault, supervisors), preload, renderer `routes/<feature>/` |
| app | `apps/cli` | `agentic` commands |
| test | `packages/testing` | Test-only helpers: ephemeral Postgres, per-file DBs, `fakeProvider` (ADR 0013) |

## Fast path

1. Read `ROADMAP.md`, then only the docs and package your task touches.
2. Use `rg --files <zone>` and targeted `rg` before opening whole folders.
3. Reuse before creating:
   - types from `packages/contracts`,
   - components from the design-system catalog,
   - services from the owning module.
4. Ignore `node_modules/`, `dist/`, `out/`, `.turbo/`, `release/`, and
   `pnpm-lock.yaml` (unless dependencies change).

## Engineering rules

**Readability**

- Source files: **hard limit 250 lines, aim for ≤150**. One concept per
  file. Split by behavior.
- kebab-case file names, named exports, and a public API only through each
  package's `index.ts`.
- Comments explain **why**, not what. No dead code or commented-out code.

**Architecture**

- Respect layer direction. In Core, the call chain is
  `routes → service → repository`. Modules talk through services only.
- Log with `moduleLogger` from `packages/logger` (fields first, message
  last). No `console.*` in packages; never log secrets or CLI arguments.
- Validate with **Zod at every boundary** (IPC, HTTP, WS, env, LLM output).
  No `any`, and no `as` casts on boundary data.
- Contracts live only in `packages/contracts`. No duplicate DTOs. Open sets
  are `text` + Zod, never pg enums.
- Agents and workflows are data. **No role-specific code** in runners.
  Side effects go through tools.
- **LangGraph checkpoints are the source of truth** for run and chat state.
  Persist events before broadcasting them.
- Every query is scoped by `workspace_id`. Code must stay correct on a
  shared team DB (leases for jobs, advisory lock for migrations).

**Boundaries**

- Provider-specific CLI code stays in `packages/cli-bridge`.
  Provider-specific LLM code stays in `packages/llm`. GitHub and Jira code
  stays in `packages/integrations`.
- UI uses design tokens only (no raw hex) and shadcn primitives. Entity
  color + icon come from `EntityAvatar`/`EntityChip`.

**Security**

- Secrets live only in the Electron `safeStorage` vault. Never in Postgres,
  logs, run events, or the UI. Never commit `.env`.
- Electron: `contextIsolation` on, `nodeIntegration` off, `sandbox` on,
  strict CSP. The renderer reaches native code only via the typed preload
  bridge.
- Core binds to `127.0.0.1`, requires the per-launch token, and refuses
  foreign origins. Anything an agent runs in a folder goes through
  `Toolbox.checkDir` (scratch, worktrees, allowed folders).
- New dependencies: exact pins, no release younger than 7 days, and no
  high advisory in production deps (CI `audit` job; see `docs/security.md`).
- Agent write actions (git push, PR, comment, Jira transition) go through
  the approval policy.

## Delivery

- Work on a feature branch. Push or merge only with the owner's
  authorization. Follow the destination repository's branch rules.
- Commit messages: imperative summary, then what changed and why.

## Commands

```bash
pnpm install
pnpm dev            # desktop app; starts local Postgres + embedded core
pnpm check-types
pnpm lint
pnpm db:generate    # drizzle migrations
pnpm --filter @agentic/core start   # headless Core (AGENTIC_DATABASE_URL, AGENTIC_DB_TLS, AGENTIC_DATA_DIR,
                                    # optional AGENTIC_OPENROUTER_API_KEY, AGENTIC_OPENROUTER_BASE_URL,
                                    # AGENTIC_GITHUB_API_URL, AGENTIC_SECRET_GITHUB_TOKEN,
                                    # AGENTIC_SECRET_JIRA_TOKEN, AGENTIC_LOG_DIR, AGENTIC_LOG_LEVEL)
apps/cli/bin/agentic.mjs <command>  # the `agentic` CLI (status, doctor, login, logout, agents,
                                    # workflows, runs, threads, serve); `--help` lists them (ADR 0011)
pnpm test           # unit + integration (ephemeral Postgres) + UI tests (ADR 0013)
pnpm test:coverage  # the same with v8 coverage in coverage/
pnpm vitest run packages/<pkg>      # one package; --project unit|integration|ui
pnpm test:e2e       # Electron E2E (Playwright, macOS): builds, then drives the app
pnpm --filter @agentic/desktop package --mac --arm64 --publish never   # packaged app in apps/desktop/release
node apps/desktop/scripts/check-package.mjs <app>   # smoke check a packaged app (no launch)
node scripts/release.mjs version <x.y.z>   # bump app + CLI versions, date CHANGELOG.md (docs/release.md)
```

## Verification

- Run `pnpm check-types`, `pnpm lint` (layer and file-size checks
  included), and the tests for the packages you touched. For UI or runtime
  changes, run the app and exercise the changed flow.
- Add tests with new behavior, next to the code: `*.test.ts` (unit),
  `*.int.test.ts` (needs Postgres; use `createTestDatabase()` from
  `@agentic/testing`), `*.test.tsx` (components). Use `fakeProvider` instead
  of real CLIs or APIs.
- In your summary, name any verification you skipped and why. A step with
  skipped verification stays **todo** in `ROADMAP.md`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
