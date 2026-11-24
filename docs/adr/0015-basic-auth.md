# ADR 0015: Basic user auth

- **Status:** accepted (Phase 17, 2026-10-12)
- **Relates to:** D8 (vault), D9 (localhost token), D13 (basic auth last), ADR 0001, ADR 0011, ADR 0014, P17.1–P17.5
- **Amends:** ADR 0003 §3 (Core's request context), ADR 0011 (the CLI signs in)

## Context

Until Phase 17 Core acted as one bootstrapped local user for every
request. On a team DB every app shared that identity, so `created_by`
meant nothing and anyone could change anything. D13 asks for email +
password accounts and workspace membership, with no external IdP.

## Decision

1. **Two credentials, two jobs.** The per-launch token (`Authorization`)
   still guards the transport: it proves the caller is this app, the CLI,
   or a script of the same macOS user (D9). A **session token**
   (`x-agentic-session`, or `?session=` on the WebSocket) says which user
   acts. Every module route needs both; `/auth/status`, `/auth/sign-up`,
   and `/auth/sign-in` need only the first.
2. **Accounts.** `users` gains `password_hash` (scrypt, N=2^15, r=8, p=1,
   16-byte salt, stored as `scrypt$N$r$p$salt$hash`, from `node:crypto`).
   Emails are trimmed and lowercased. Passwords are 8–256 characters, no
   composition rules (NIST 800-63B).
3. **Membership.** `workspace_members` (`owner`/`member`, text + Zod)
   decides access. Everyone joins the default workspace, so a team DB is
   one **shared workspace**. Owners change roles, remove members, and set
   sign-in options; a workspace always keeps an owner. Members can use
   and change everything else.
4. **The first account claims the local user.** Bootstrap still creates a
   `local` user as owner. The first sign-up turns it into a password
   account (same id), so existing rows keep their owner; later sign-ups
   are members. A lock serializes sign-ups on a shared DB.
5. **Sessions.** 256 random bits, prefixed `ags_` (log redaction knows the
   shape). Core stores only SHA-256 of the token, in `auth_sessions`, with
   a 30-day expiry that slides when used with under 15 days left. Sign-out
   deletes the row; removing a member deletes theirs. A token Core doesn't
   know is an error (`auth.session_invalid`), never a silent fallback, so
   clients drop it and ask again.
6. **Local vs team DB.** On the local DB, a request without a session
   **auto signs in** as the workspace's first owner (on by default; an
   owner can turn it off once that owner has a password). On a remote DB
   Core never auto signs in. Core decides from its DB mode; the headless
   Core (`agentic serve`) is always remote.
7. **Where tokens live.** The desktop keeps its session in the vault
   (`auth.session`, managed, never handed to Core as a provider secret);
   main returns it to the renderer over IPC, the one vault value that
   crosses IPC, because the renderer presents it to Core exactly like the
   per-launch token it already holds. The CLI has no Keychain:
   `agentic login` writes `<dataDir>/cli/session.json` (0600 in a 0700
   folder) next to the runtime file; `AGENTIC_SESSION` overrides it.
8. **Guessing.** Ten failed sign-ins per email in 15 minutes lock that
   email for the rest of the window (in memory, per Core). An unknown
   email still runs scrypt against a dummy hash, and both failures return
   the same `auth.invalid_credentials`.

## Consequences

- The single-user experience on the local DB is unchanged until someone
  turns auto sign-in off.
- Sign-up is open to anyone who can reach Core, which on a team DB means
  anyone holding the connection string, who could read the database
  anyway. Whoever signs up first owns a fresh team DB, so the admin
  should sign up first.
- Sign-up says when an email is taken; on a shared team DB that is
  acceptable (members know each other).
- A removed member's open WebSocket lives until it reconnects.
- The rate limit is per Core process, not shared across apps on one DB.
