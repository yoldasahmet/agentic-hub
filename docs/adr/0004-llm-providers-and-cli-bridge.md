# ADR 0004: LLM providers and the CLI bridge

- **Status:** accepted (Phase 5, 2026-10-10)
- **Relates to:** D6 (providers mirror the CLIs), D7 (contracts), D8 (secrets), P5.1–P5.7
- **Amended by:** ADR 0014 §4 (model calls without a timeout stop after 30 minutes)

## Context

Agents call models through four CLIs (Claude Code, Codex, Gemini CLI,
OpenCode), each signed in with its own account, and through the OpenRouter
HTTP API. The reference repo had two CLI parsers that drifted apart (R6)
and providers defined in three places (R3).

## Decision

1. **One process layer.** `packages/cli-bridge` is the only code that spawns
   CLIs. It resolves the command on a search PATH (the login shell's PATH on
   macOS, since a Finder-launched app gets `/usr/bin:/bin`), validates the
   working directory (absolute, existing, symlinks resolved), and runs the
   CLI without a shell in its own process group. Cancel and timeout send
   SIGTERM to the group, then SIGKILL after 3 s. Closing the HTTP request
   that started a call cancels it.
2. **Env allowlist, not blocklist.** A CLI sees locale, home, temp, proxy
   and CA variables, plus the prefixes its spec names for its own auth
   (`ANTHROPIC_`/`CLAUDE_`, `OPENAI_`/`CODEX_`, `GEMINI_`/`GOOGLE_`,
   `OPENCODE_`). `AGENTIC_*` and everything else are dropped. stderr shown
   in errors is redacted (known secret values and common token shapes).
3. **A CLI is a spec + a parser.** `CliSpec` holds the flags, the env
   prefixes, capabilities, and the auth check; one parser file per CLI
   turns its JSONL into `LlmEvent`s. Parsers validate each line with Zod
   and skip lines they don't know, so a CLI adding event types doesn't
   break a run. The generic `streamCli` turns every failure (not installed,
   bad cwd, non-zero exit, cancel, timeout) into an `error` event, and
   `done` is always last.

   | CLI | Invocation | Prompt | Native schema |
   | --- | --- | --- | --- |
   | Claude Code | `claude -p --output-format stream-json --verbose --include-partial-messages --no-session-persistence` | stdin | `--json-schema` |
   | Codex | `codex exec --json --skip-git-repo-check --sandbox read-only -` | stdin | `--output-schema <file>` |
   | Gemini CLI | `gemini --output-format stream-json --prompt=…` | argv | no |
   | OpenCode | `opencode run --format json -- …` | argv | no |

   The Claude Code format was recorded from CLI 2.1.296. The Codex, Gemini,
   and OpenCode formats follow their docs and are covered by fixtures until
   the owner checks them on a Mac (those CLIs aren't in the cloud container).
4. **Normalized usage.** `inputTokens` excludes cache reads and writes, which
   are reported separately (Codex, Gemini, and OpenRouter include cached
   tokens in their input count; we subtract them). Cost is the provider's
   own figure when it reports one (Claude Code, OpenCode, OpenRouter), else
   the catalog price, else unknown (`null`).
5. **Catalog as data.** `packages/llm/config/llm-catalog.json` lists models
   per provider, parsed with Zod at load. Claude models use the CLI's
   aliases (`sonnet`, `opus`, `haiku`) so the catalog doesn't go stale;
   `default` leaves the choice to the CLI's own config. OpenRouter's full
   list is synced into the `models` table (off by default). Catalog models
   are on unless a workspace turns them off.
6. **Structured output.** Providers with a native schema option get the
   schema; the others get it in the system prompt and the JSON is extracted
   from the text. Either way the value is validated (`z.fromJSONSchema`) and
   a mismatch is sent back for repair, up to two retries.
7. **Provider secrets.** The OpenRouter key lives in the vault
   (`openrouter.api-key`). Main sends provider secrets to Core in the start
   config and again (`secrets` message) whenever one changes, so a new key
   works without a restart. Core keeps them in memory only. Headless Core
   reads `AGENTIC_OPENROUTER_API_KEY`. `AGENTIC_OPENROUTER_BASE_URL` points
   OpenRouter calls at a gateway or a test stand-in.
8. **PTY fallback.** `openPty` (node-pty, N-API, loaded lazily so a broken
   native build can't stop Core) is the fallback for interactive CLI
   sessions; chat's terminal mode (P8.7) uses it.

## Consequences

- Adding a CLI is two files in `cli-bridge` plus a catalog entry.
- Until the tool policy (P9.1), CLI tools run under each CLI's own
  defaults: Claude Code's print-mode permissions, Codex read-only sandbox,
  Gemini's default approval mode. OpenCode auto-approves its tools; the
  working dir for Settings tests is a private scratch dir.
- `node-pty` is a desktop dependency so the Core bundle keeps it external;
  P18.1 handles signing the prebuilt binaries.
