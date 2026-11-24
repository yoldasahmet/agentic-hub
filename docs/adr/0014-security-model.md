# ADR 0014: Security model

- **Status:** accepted (Phase 15, 2026-10-12)
- **Relates to:** D9 (embedded Core, localhost token), ADR 0001, ADR 0008, ADR 0012, P9.4, P15.1–P15.4
- **Amends:** ADR 0003 §3, ADR 0004, ADR 0005, ADR 0007, ADR 0008 (origins, deadlines, one working-dir rule, scrubbed run events)

## Context

Phase 15 reviewed the app against the threat model in
[`docs/security.md`](../security.md). Most controls were in place; four gaps
needed a decision.

## Decision

1. **Origins.** Core accepts HTTP and WebSocket requests only without an
   `Origin`, from the renderer (`file://`/`null`), or from a loopback origin
   (dev). The token stays the security boundary; this turns away web pages
   before they reach it.
2. **One working-dir rule.** Anything that runs in a folder for an agent
   (tools, CLI agents, chats) must be in scratch, a run worktree, or an
   allowed folder (`Toolbox.checkDir`). A chat's folder is checked when set
   and again on every message. Interactive terminals are exempt.
3. **Scrub run events.** `EventLog.append` masks token shapes and vault
   values in every string before storing or broadcasting, without masking
   by key (an output field may be called `token`).
4. **Deadlines.** A model call without `timeoutMs` stops after 30 minutes
   (`DEFAULT_LLM_TIMEOUT_MS`).
5. **Dependencies.** A CI audit (production, high+) on every push and
   weekly, Dependabot with a 7-day cooldown, and pnpm `minimumReleaseAge`.

## Consequences

- A chat or agent pointed at a folder outside Settings → Tools → Allowed
  folders now fails with `tool.dir_denied` (HTTP 403) and says where to add
  it. Before, tool-less CLI agents ran anywhere.
- A secret that is also an ordinary word (≥ 6 characters) is masked in run
  events too.
- Fresh releases wait a week unless they fix an advisory.
