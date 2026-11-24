# Reference web app review

A review of the reference web app, done to decide what Agentic Hub keeps,
what it changes, and what it drops. The reference repo is **read-only**. We
port ideas and code from it into this repo, and never edit it.

- **Reviewed:** `main`, 2026-10-10
- **Size:** about 13k lines of TypeScript. A Next.js dashboard, two Hono
  services (`api`, `agents`), 12 packages, and Trigger.dev jobs.

## Summary

The prototype demonstrates agents with JSON
Schema inputs and outputs, workflows compiled to LangGraph with bindings and
human gates, CLI adapters, and GitHub/Jira integration. It grew features
faster than structure, though. The main gaps are:

- no real identity,
- several sources of truth for the same data,
- domain behavior hardcoded inside generic runners,
- almost no tests.

Agentic Hub keeps the ideas and rebuilds the structure.

## What to keep

- Monorepo split into contracts, db, ui, and cli-bridge packages.
- JSON Schema as the agent I/O format, with a lossless UI field model
  (`packages/types/src/io-schema.ts`).
- The workflow binding model (literal, workflow input, node output,
  expression, fallback) and JSON-logic conditions
  (`packages/workflow-runtime`).
- Static workflow validation with stable issue codes.
- Compiling workflows to a real LangGraph `StateGraph` with interrupts,
  retry-from-node, and fork (`apps/agents/src/langgraph-compiler.ts`).
- Persisting events before broadcasting them, and replaying by sequence
  cursor.
- Structured CLI streams first, with a PTY fallback.
- An LLM catalog kept as editable data.

## Problems found

| # | Area | Finding | Evidence |
| --- | --- | --- | --- |
| R1 | Identity | The API trusts a client-sent `x-user-id` header and accepts any UUID. There is no auth; only CORS protects it. | `apps/api/src/lib/local-user.ts`, used in 10 route files |
| R2 | Secrets | The GitHub token and Jira API key are stored in plaintext in `user_settings`. | `packages/db/src/schema/settings.ts` |
| R3 | Sources of truth | Providers are defined three times: the pg enum `cli_provider`, `config/llm-catalog.json`, and the `llm_providers` table. Adding a CLI needs a migration. | `schema/chats.ts`, `schema/llm.ts` |
| R4 | Events | One 25-value pg enum `event_type` mixes chat, agent, and workflow events, so every new event needs a migration. | `schema/messages.ts` |
| R5 | Run state | There are three run systems (chat sessions, `agent_runs`, `workflow_runs`). `workflow_checkpoints` duplicates LangGraph checkpoints, and a custom 276-line `DrizzleSaver` replaces the official saver. | `schema/workflows.ts`, `apps/agents/src/drizzle-checkpointer.ts` |
| R6 | CLI execution | There are two CLI stream parsers: `packages/cli-bridge` for chats and `runners/cli-stream.ts` (472 lines) for agents. A fix in one doesn't reach the other. | `packages/agents/src/runners/` |
| R7 | Domain leaks | Generic runners hold role-specific logic: designer vs. planner modes, PR-comment posting in the subgraph runner, and an Anthropic SDK path when an env var is set. | `runners/llm.ts`, `runners/subgraph.ts` |
| R8 | Composition overlap | Agents carry `routing` (output → next agent) and a `subgraph` kind, which overlap with workflow edges. That gives two ways to compose. | `packages/types/src/agent.ts` |
| R9 | Contracts | Hand-written TS interfaces in `types` and separate Zod schemas in `events` drift apart. `AgentConfig` is an open `[key: string]: unknown` bag. | `packages/types`, `packages/events` |
| R10 | Readability | 39 files break the repo's own 250-line rule. The largest are `right-rail.tsx` (848), `composer.tsx` (657), and `panel-view.tsx` (646). | `packages/ui`, `apps/web` |
| R11 | Tests | There is 1 Playwright spec and no unit or API tests. | `apps/web/e2e/workflows.spec.ts` |
| R12 | Process model | Next.js, the API, the agents runtime, and optional Trigger.dev polling every 3 s use in-memory event buses. That is heavy for a desktop app and unsafe on a shared DB (duplicate schedules). | `trigger/`, `apps/agents/src/pubsub.ts` |
| R13 | UX | "Resume with edit" and node config overrides need raw JSON. Custom buttons and toggles (`primitives.tsx`, 479 lines) duplicate shadcn. The dark slate theme has low depth. | `docs/workflows.md`, `packages/ui/src/agents/primitives.tsx` |
| R14 | Content in code | Built-in agents and 10 skill files are hardcoded TypeScript seeds in the API. | `apps/api/src/lib/seed-*.ts` |

## Refactor decisions

| Finding | Decision in Agentic Hub | Roadmap |
| --- | --- | --- |
| R1 | Per-launch token on `127.0.0.1` now. Identity is always derived on the server. Basic accounts and workspace membership come in the auth phase. | P4.3, Phase 17 |
| R2 | Secrets go in the Keychain vault. The DB stores only references. | P2.8 |
| R3 | Providers are code plugins plus catalog data. No pg enums for open-ended sets. | P3.3, P5.4 |
| R4 | Event type is `text` plus a Zod discriminated union in `contracts`. | P3.3, P4.7 |
| R5 | One `runs` + `run_events` model. `PostgresSaver` is the only state store. History comes from `getStateHistory`. | P4.5–P4.8 |
| R6 | One `packages/cli-bridge` with one parser per CLI, used by chat, agents, and workflows. | P5.1–P5.2 |
| R7 | Runners are generic. Behavior comes from data (output schema + format renderers). Side effects happen only through tools. | P6.5–P6.6 |
| R8 | An agent is a single unit. Composition happens only in workflows (subworkflow nodes). | P6.1, P7.4 |
| R9 | Zod-first `packages/contracts` with inferred types and a typed config per agent kind. | P1.3 |
| R10 | 250-line hard limit (aim for ≤150), feature folders, checked in CI. | P1.4–P1.5 |
| R11 | Logging and testing are built from scratch in Milestone C. | Phases 13–14 |
| R12 | One embedded core process. Postgres job queue with leases. `EventBus` interface. | P4.2, P4.9 |
| R13 | Claude-light design system, one shared `SchemaForm` everywhere, shadcn primitives only. | P2.4–P2.5, P6.2 |
| R14 | Built-ins ship as data files (JSON/YAML) loaded by importers. | P6.8, P7.10 |

## Reuse list

Port these, then split each file below 250 lines and restyle it to the
design system. **Do not copy files verbatim.**

| Reference | Becomes |
| --- | --- |
| `packages/types/src/io-schema.ts`, `workflow.ts` | `packages/contracts` (Zod-first) |
| `packages/workflow-runtime/src/{bindings,jsonlogic,validate}.ts` | `packages/workflows` |
| `apps/agents/src/{langgraph-compiler,langgraph-node,langgraph-state}.ts` | `packages/workflows/compiler/` |
| `apps/agents/src/workflow-controller.ts` (406 lines) | `packages/graph/runs/`, split into start, resume, finalize |
| `packages/cli-bridge/src/adapters/{claude-code,headless,pty}.ts` | `packages/cli-bridge` |
| `apps/api/src/lib/{github,jira}-client.ts` + routes | `packages/integrations/{github,jira}` + core modules |
| `packages/ui/src/agents/{field-card,inputs-column,outputs-column}.tsx` | `packages/ui` `SchemaEditor` |
| `packages/ui/src/workflows/editor/*` | `packages/ui` workflow canvas, inspectors, validation panel |
| `packages/ui/src/chats/{chat-stream,message-bubbles,composer}.tsx` | `packages/ui` `EventStream`, `Composer` |
| `packages/ui/src/selectors/llm-selector.tsx` | `packages/ui` `ModelPicker` |
| `apps/web/app/(dashboard)/workflows/checkpoint-inspector.tsx` | `packages/ui` `StateInspector` |
| `apps/web/app/(dashboard)/github/pull-diff*.tsx` | `packages/ui` `DiffViewer` |
| `packages/workflow-templates/src/sdlc-pipeline.ts` | `packages/workflows/templates/sdlc-pipeline.json` (JSON bundle with its `sdlc-*` agents, skills, and the Figma MCP server; ADR 0006). The reference's `github` and `filesystem` MCP servers became the built-in `github.*` and `fs.*` tools (approval policy, worktree-scoped); `cli`/`llm` kinds became `llm` on Claude Code. |
