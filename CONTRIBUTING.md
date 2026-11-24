# Contributing

How to set up, change, and extend Agentic Hub. Coding agents should read
[`AGENTS.md`](AGENTS.md) too; it has the same rules in checklist form.

## Setup

Requirements: macOS (the target platform; Linux works for everything but
the Electron window and packaging), **Node 22**, and **pnpm 10.28**
(`corepack enable`). No Docker: the app ships its own Postgres binaries.

```bash
pnpm install
pnpm dev            # the desktop app: local Postgres + embedded Core + renderer
```

`pnpm dev` and the desktop's `start` script run Electron's installer before
launching electron-vite. The first launch downloads the pinned Electron
binary; later launches reuse it. This is needed because Electron 44 installs
on demand, while electron-vite checks for the binary directly.

For model calls, install and sign in to at least one CLI (`claude`,
`codex`, `gemini`, `opencode`) or add an OpenRouter key in Settings.

Useful while developing:

```bash
pnpm check-types                    # tsc in every package (turbo)
pnpm lint                           # Biome + layer rules + 250-line file check
pnpm format                         # Biome autofix
pnpm test                           # unit + integration + UI tests
pnpm vitest run packages/<pkg>      # one package; --project unit|integration|ui
pnpm test:coverage                  # v8 coverage in coverage/
pnpm test:e2e                       # Electron E2E (Playwright, macOS)
pnpm db:generate                    # SQL migration from Drizzle schema changes
pnpm --filter @agentic/core start   # headless Core (see docs/user-guide/cli.md for env)
apps/cli/bin/agentic.mjs --help     # the CLI against a running Core
```

Integration tests start a throwaway Postgres from the bundled binaries (or
use `AGENTIC_TEST_DATABASE_URL`). Set `AGENTIC_USER_DATA_DIR` to run the
app on a throwaway profile.

## Where things go

Read [`docs/architecture.md`](docs/architecture.md) first. In short:

| You're changing | Look in |
| --- | --- |
| A schema shared by two processes or packages (DTO, event, IPC) | `packages/contracts` (Zod, types inferred) |
| Tables and migrations | `packages/db/src/schema/` + `pnpm db:generate` |
| An HTTP endpoint | `packages/core/src/modules/<feature>/{routes,service,repository}.ts`, then the typed client in `packages/client` |
| A screen | `apps/desktop/src/renderer/routes/<feature>/` (`page.tsx` + `queries.ts`) |
| A reusable component | `packages/ui` (check the catalog in [`docs/design-system.md`](docs/design-system.md) first) |
| Main-process behavior (vault, menus, supervisors) | `apps/desktop/src/main/` |
| A CLI command | `apps/cli/src/commands/` |

Packages depend **down** the layers only; `pnpm lint` fails otherwise. A
new package needs a row in the layer map in `.dependency-cruiser.cjs` and
in `docs/architecture.md`.

## Conventions

- **TypeScript:** strict ESM. No `any`, no `as` casts on boundary data:
  parse with Zod at every boundary (IPC, HTTP, WS, env, files, LLM output).
- **Files:** kebab-case, named exports, one concept per file, **≤ 250
  lines** (aim for 150). A package's public API is its `index.ts`.
- **Core modules:** `routes → service → repository`. Routes validate and
  map, services hold the logic, repositories hold Drizzle queries. Modules
  call each other's services, never their repositories. Every query is
  scoped by `workspace_id` and must stay correct on a shared team DB.
- **Errors:** throw `AppError(code, message, details)`. Codes are an open
  set (`validation_failed`, `not_found`, … or `<module>.<reason>`). The
  renderer shows them with `showError`.
- **Logging:** `moduleLogger("<package>.<area>")`, fields first, message
  last. No `console.*` in packages. Never log secrets or CLI arguments.
- **Data, not code:** agents, workflows, templates, and built-ins are data.
  No role-specific branches in runners; side effects go through tools.
- **Open sets** (providers, event types, node kinds) are `text` columns plus
  Zod, never pg enums.
- **UI:** design tokens only (no raw hex), shadcn primitives from
  `packages/ui`, entity color and icon through `EntityAvatar`/`EntityChip`.
- **Comments** explain why, not what. No dead or commented-out code.
- **Dependencies:** exact versions, releases at least 7 days old, no high
  advisories in production deps (CI runs `pnpm audit --prod`).
- **Security:** read [`docs/security.md`](docs/security.md) before touching
  IPC, Core's HTTP/WS boundary, secrets, process spawning, or folders an
  agent runs in.

## Tests

Tests live next to the code (ADR 0013):

| File | Project | Notes |
| --- | --- | --- |
| `*.test.ts` | unit | No I/O beyond temp files |
| `*.int.test.ts` | integration | `createTestDatabase()` from `@agentic/testing` gives a fresh migrated DB per file |
| `*.test.tsx` | ui | jsdom + Testing Library |

Use `fakeProvider` (`@agentic/testing`) instead of real CLIs or APIs. CLI
parsers replay recorded JSONL from `packages/cli-bridge/src/parsers/fixtures/`.
Only test files and `src/test/` helpers may import `@agentic/testing`.

## Before you push

1. `pnpm check-types`, `pnpm lint`, and the tests of the packages you
   touched all pass.
2. For UI or runtime changes, run the app and exercise the flow.
3. Update the docs your change affects: `docs/architecture.md`, the design
   system catalog, the [user guide](docs/user-guide/README.md), and an ADR
   for significant decisions ([`docs/adr/README.md`](docs/adr/README.md)).
4. Tick the step in `ROADMAP.md` (Status table, Current focus) in the same
   commit. A step with skipped checks stays todo.
5. Commit messages: an imperative summary, then what changed and why.

Work on a feature branch. CI (`.github/workflows/ci.yml`) runs lint,
types, and tests with coverage on macOS, plus the dependency audit.

---

## Adding an LLM provider

### A CLI

Everything CLI-specific stays in `packages/cli-bridge` (ADR 0004).

1. **Spec:** `packages/cli-bridge/src/specs/<cli>.ts` exports a `CliSpec`:
   `id`, `name`, `command`, `passEnv` (env prefixes for the CLI's own auth),
   `capabilities` (`structuredOutput: "native"` only if it takes a JSON
   Schema; `mcp: true` only if it runs MCP servers itself), `versionArgs`,
   `invoke(req, extras)` (arguments; send long prompts on `stdin`, never in
   argv when the CLI allows it), optional `sessionArgs` for terminal mode,
   `createParser()`, and `checkAuth()`.
2. **Parser:** `packages/cli-bridge/src/parsers/<cli>.ts` implements
   `StreamParser` (`push(line) → LlmEvent[]`; `lineParser` builds one from
   a Zod union): parse each JSONL line with Zod, skip unknown lines, and
   emit `LlmEvent`s (text, thinking, tool call/result, usage, error).
   `streamCli` adds the final `done` and turns process failures into
   `error` events.
3. **Register** it in `specs/all.ts`. `createDefaultProviders` in
   `packages/llm` wraps every spec as a provider; there is nothing to add
   there.
4. **Catalog:** add a `providers` entry to
   `packages/llm/config/llm-catalog.json` (models, labels, reasoning
   options, prices when the CLI doesn't report cost; `default` lets the
   CLI choose).
5. **Tests:** record real output into `parsers/fixtures/<cli>.jsonl` (plus
   an error case) and replay it in a parser test. Don't call the real CLI
   in tests.
6. **Docs:** the provider table in `docs/architecture.md` and
   `docs/user-guide/getting-started.md`.

### An HTTP API

Implement `LlmProvider` (`packages/llm/src/provider.ts`) in
`packages/llm/src/<provider>/`, following `openrouter/`: map the stream to
`LlmEvent`s (failures are events, never exceptions), take the API key
through a getter so a new key works without a restart, and register it in
`createDefaultProviders`. The key lives in the vault: add its name to
`PROVIDER_SECRETS` in `packages/contracts/src/llm/secrets.ts` so main
hands it to Core, and a headless env variable in
`packages/core/src/headless.ts`. Test with a `fetch` stand-in, as
`openrouter` does.

## Adding a tool

Built-in tools live in `packages/tools/src/builtins/` (ADR 0008):

```ts
export const fsRead = defineTool({
  name: "fs.read",                  // <group>.<action>; `fs.*` grants the group
  title: "Read file",
  description: "…",                 // shown to models and people
  permission: "read",               // read | write | dangerous
  input: z.object({ path: z.string() }),
  async run(input, ctx) { … },      // input is already parsed
});
```

- Add it to `builtinTools()` in `builtins/index.ts`.
- Use `ctx`: stay inside `ctx.cwd` (already checked against the allowed
  folders), pass `ctx.signal` on to anything slow, respect
  `ctx.maxOutputBytes`, and run commands through `cli-bridge`'s
  `runProcess`, never `child_process` directly.
- Pick the permission honestly: anything that changes files, remote state,
  or sends data is at least `write`; arbitrary commands are `dangerous`.
- Tests: input validation, the happy path, and the guardrails.

Integration tools are the same `defineTool` calls inside
`packages/integrations/src/<name>/tools/`, registered by the Core module
(below). Tools for the chat App (`AppTool`s) are separate: see
`packages/core/src/modules/jira/app-tools.ts`.

## Adding an integration

Use Jira as the template (ADR 0010). An integration has up to four parts:

1. **Contracts** in `packages/contracts/src/<name>/`: entities, inputs, the
   trigger config, and its vault secret names (`<name>.token`). Add the
   prefix to `INTEGRATION_SECRET_PREFIXES` in
   `packages/contracts/src/llm/secrets.ts` so main hands the secret to Core,
   and handle `AGENTIC_SECRET_<NAME>_*` in `packages/core/src/headless.ts`.
2. **Client and tools** in `packages/integrations/src/<name>/`: an API
   client (Zod-parsed responses, backoff on rate limits), read and write
   tools, and a trigger poll function. No Core or UI code here.
3. **Core module** in `packages/core/src/modules/<name>/`: `index.ts`
   (`create<Name>Module` builds the connection, registers tools on the
   shared `ToolRegistry`, returns services and App tools), `routes.ts`,
   `service.ts`, and a settings repository for non-secret config. Wire it in
   `packages/core/src/core.ts` and `app.ts`, then add a client in
   `packages/client`.
4. **Triggers:** a trigger kind in `packages/contracts/src/workflows/triggers.ts`
   and a poller in `packages/core/src/modules/triggers/` (see
   `jira-poller.ts`): save the cursor and seen keys before starting runs,
   so an item never fires twice, and claim due polls with `SKIP LOCKED`.
5. **UI:** a page under `apps/desktop/src/renderer/routes/<name>/`, a
   settings page under `routes/settings/<name>/`, trigger fields in
   `routes/workflows/triggers/`, and a sidebar entry in
   `apps/desktop/src/renderer/shell/nav-items.ts`.

Write actions (comment, push, transition, …) are `write` tools so they go
through each agent's approval policy. Tokens never leave Core: not in
logs, run events, argv, or files.

## Adding an agent template or workflow template

Both are data. Agent library entries are bundles in
`packages/agents/builtins/*.json`, registered in
`packages/agents/src/builtins.ts` (the skills they name are built-ins in
`packages/agents/builtins/skills/`, added with the agent); workflow templates are bundles in
`packages/workflows/templates/*.json`, registered in
`packages/workflows/src/templates.ts` (their agents are referenced by
slug; a template can carry its own `agents`, `skills`, and `mcpServers`,
and `templates.test.ts` checks it validates and brings every skill and
server its agents name). The easiest way to make one is to build it in the app and **Export
as JSON**. Both lists are parsed at startup, so a bad file fails fast.
