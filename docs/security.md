# Security model

The threat model, the Phase 15 review, and the Phase 17 auth review. Read this before you touch IPC,
Core's HTTP/WS boundary, secrets, process spawning, or dependencies.
Decisions are in [ADR 0014](adr/0014-security-model.md) and
[ADR 0015](adr/0015-basic-auth.md) (auth).

## Assets

| Asset | Where it lives |
| --- | --- |
| Provider keys, GitHub/Jira tokens, MCP secrets, DB URLs/passwords | Electron `safeStorage` vault (main); a memory copy in Core |
| Core's per-launch token | Main and Core memory; `runtime/core.json` (0600 in a 0700 folder) for the CLI |
| Passwords | Never stored: a scrypt hash in `users.password_hash` |
| Session tokens | Desktop: the vault (`auth.session`); CLI: `<dataDir>/cli/session.json` (0600 in a 0700 folder); Core stores only their SHA-256 |
| The user's repositories and files | Allowed folders, scratch, run worktrees |
| Run and chat state | Postgres (local service or team DB) |
| The ability to act as the user (push, comment, transition) | Tools behind the approval policy |

## Trust boundaries and threats

| # | Boundary | Threat | Controls |
| --- | --- | --- | --- |
| T1 | Renderer → main (IPC) | Compromised renderer (XSS via model output, a malicious package) reads secrets or runs native code | `contextIsolation`, `sandbox`, no `nodeIntegration`, no webviews; the preload exposes only the contract's channels; main checks the sender frame on every call and validates input **and** output with Zod; no IPC channel returns a secret value (`secrets.list` is metadata, the vault decrypts in main only) except `auth.session`, the renderer's own Core session (ADR 0015 §7); managed secrets can't be overwritten from the UI |
| T2 | Renderer content | Script injection, remote code, exfiltration | Strict CSP (`default-src 'none'`, `script-src 'self'`, connect only to `127.0.0.1`), no `dangerouslySetInnerHTML`/`eval`, navigation and redirects pinned to the app page, `window.open` → https in the browser only, every permission request denied, DevTools off in packaged builds |
| T3 | Other local processes / web pages → Core | A web page or another user's process drives Core (CSRF, DNS rebinding, cross-site WebSocket) | Core binds `127.0.0.1` on a random port; every route but `/health` needs the 256-bit token (constant-time compare); Host must be loopback; **Origin must be absent, the renderer (`file://`/`null`), or loopback** for HTTP and WebSocket; CORS answers only those origins; WS payloads capped at 64 KB |
| T4 | Main → Core | Credentials leak through `ps`/env | Secrets go over the utility-process message port, never argv or env; local Postgres gets its password through a 0600 file |
| T5 | Core → CLIs, MCP servers, tools | Prompt injection makes an agent read or write outside the user's project, or a CLI inherits app secrets | Working dirs must be scratch, a run worktree, or an **allowed folder** (symlinks resolved) for tools, CLI agents, and chats; tool paths can't leave their working dir; children get an allowlisted env (no `AGENTIC_*`); no shell, own process group, killed on cancel/timeout; every model call has a deadline; write tools ask first (approval policy); MCP servers from an imported bundle or template are created **disabled**, so their command never runs before a person enables it |
| T6 | Logs, run events, diagnostics, UI | A secret is written to disk or shown | Logs: secret-named keys, token shapes, DB URLs, and every vault value Core holds are masked; **run events are scrubbed the same way before they are stored or broadcast**; tool results and agent output are masked; diagnostics omit Core's token |
| T7 | Core ↔ team DB | Eavesdropping or a rogue server | TLS `verify-full` by default (`require` for self-signed, `disable` by explicit choice); `sslmode` in the URL is ignored so the setting is the only source; URL kept in the vault; every query scoped by `workspace_id` |
| T8 | Supply chain | A malicious or vulnerable dependency ships in the app | Exact pins + frozen lockfile; pnpm blocks install scripts except an allowlist; `minimumReleaseAge` (7 days); CI fails on high/critical advisories in production deps (also weekly); Dependabot with a 7-day cooldown |
| T9 | Users of one team DB → each other | A member acts as another, guesses a password, or keeps access after removal | Every module route needs a session from a current member (`requireSignedIn`; WS upgrades too); scrypt hashes; a dummy hash and one error code for unknown emails and wrong passwords; 10 failures per email per 15 min lock it; tokens are 256-bit, stored hashed, expire (30 days, sliding), and are deleted on sign-out and member removal; member and settings changes are owner-only and a workspace keeps an owner; auto sign-in only on the local DB |

Out of scope: code already running as the same macOS user (it can read
the CLI session file and the runtime token), a malicious
CLI binary on `PATH`, and a hostile team-DB administrator.

## Review results (Phase 15)

**P15.1 — IPC, token, CSP, isolation.** The baseline from P2.2/P4 held.
Fixed: Core reflected any `Origin` in CORS and accepted WebSocket upgrades
from any origin. The token still blocked those requests, but foreign
origins are now refused before the token check (`requireTrustedOrigin`,
`isTrustedOrigin` in `packages/core/src/http/auth.ts`).

**P15.2 — Secrets.** Vault-only storage, IPC, logs, and DB TLS held.
Fixed: run events were persisted and broadcast unscrubbed, so a vault value
echoed in model text or a CLI error reached Postgres and the UI. `EventLog`
now runs every string through `redactStrings`. Added token shapes: GitLab,
Slack, Atlassian, AWS access keys, JWTs, PEM private keys.

**P15.3 — Execution safety.** Tool calls were held to the allowlist, but a
CLI agent's working dir (from a fixed path, a workflow input, or a chat)
was only checked for existence, and CLIs that run MCP servers themselves
skipped the tool-call check. `resolveWorkingDir` and the chat service now
use `Toolbox.checkDir`, the same rule tools use. Model calls without
their own timeout (the chat App and intake) now stop after 30 minutes.

**P15.4 — Dependencies.** `@modelcontextprotocol/sdk` 1.30.1 had a high
advisory (GHSA-6qxp-vccf-f47h); bumped to 1.31.0. Remaining: `esbuild`
≤0.24 under `drizzle-kit` (dev-only; the advisory needs esbuild's dev
server, which drizzle-kit never starts). Accepted until drizzle-kit drops
`@esbuild-kit`.

## Review results (Phase 17)

**P17.5 — Auth.** Checked against T3, T6, and T9 with integration tests
(`auth-team.int.test.ts`, `auth-local.int.test.ts`, `security.int.test.ts`).
Found and fixed during the review: the renderer's cross-origin preflight
didn't allow `x-agentic-session`, so a signed-in renderer would have been
refused (now in CORS `allowHeaders`, with a test); expired session rows
were never deleted (a new session now clears the user's expired ones).
Added: the `ags_` token shape to log and event redaction. Accepted (see
ADR 0015): open sign-up on a team DB (holders of the connection string
already have the data), the first sign-up owning a fresh team DB, and
sign-up revealing that an email is taken.

### Residual risks

- Interactive terminals run in the folder the user picks; they are the
  user's own shell, so the allowlist doesn't apply.
- A secret split across two streamed `message.delta` events can escape the
  event scrub; LangGraph checkpoints hold model output as produced.
- A removed member's open WebSocket keeps streaming until it reconnects;
  the sign-in rate limit is per Core process, not shared across apps.
- On the local DB with auto sign-in on, anyone with the per-launch token
  acts as the owner (as before Phase 17).
- Electron fuses are set in packaged builds (P18.1, ADR 0016): RunAsNode,
  `NODE_OPTIONS`, and `--inspect` off; cookie encryption, ASAR integrity,
  and only-load-from-ASAR on. The file:// privileges fuse stays on because
  the renderer loads from file://. The hardened runtime is configured, but
  builds stay unsigned until the owner's Developer ID is set up (P18.3), so
  ASAR integrity isn't enforced by a signature yet.
- A local database backup (P18.2) is the whole cluster, unencrypted: treat
  the file like the database itself. Restore resets the superuser password
  to this Mac's vault value, so a backup carries no usable credential.

## Public source and credentials

Source builds use the provider accounts that each person connects. The Codex
workflow examples work with CLI sign-in. OpenRouter uses a vault key, and
GitHub can use a vault token or a local `gh` login for the configured HTTPS host. Signing credentials for
macOS builds belong in the release environment. Codex MCP launches reference
per-server environment variables so header and environment values stay out of
command-line arguments. See [Release setup](release.md) for signing details.

For a source release, run `gitleaks git --redact --log-opts="--all"` and
`pnpm audit --prod --audit-level high`. Two historical Gitleaks matches in
`packages/logger/src/redact.test.ts` at commit `a8a6e9a` are synthetic
Slack and JWT redaction fixtures. The current tests build those strings at
runtime.

## Dependency update policy

1. Pin exact versions; change `pnpm-lock.yaml` only through `pnpm install`.
2. Don't take a release younger than 7 days (`minimumReleaseAge`,
   Dependabot `cooldown`), except to fix an advisory.
3. CI's `audit` job fails on a high or critical advisory in production
   dependencies, on every push, PR, and weekly. Fix it by updating the
   package; if no fix exists, record it here with why it's not exploitable.
4. Dependabot opens grouped weekly PRs (npm minor/patch, GitHub Actions).
   Majors of Electron and LangChain are taken in a roadmap step.
5. A new dependency needs a reason: check the layer rules, its maintenance,
   and its install scripts (add to `onlyBuiltDependencies` only if needed).
