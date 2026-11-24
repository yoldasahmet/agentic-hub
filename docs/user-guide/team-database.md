# Team database

All app data (agents, workflows, runs, threads, chats, settings) lives in
PostgreSQL. You choose where in **Settings → Database**.

## Local (default)

A Postgres service bundled with the app: no Docker, nothing to install. It
runs on `127.0.0.1` on a free port, with a generated password kept in the
Keychain, and stores its data in
`~/Library/Application Support/Agentic/postgres`. The app starts and
stops it.

## Remote team DB

Point several people's apps at one shared Postgres to share agents,
workflows, runs, triggers, and the Inbox.

1. Create an empty database on a Postgres server your team can reach. The
   app creates its own tables and a `langgraph` schema.
2. In **Settings → Database**, choose **Remote** and paste the
   **connection string**
   (`postgres://user:password@host:5432/agentic`). It is stored in the
   Keychain, not in a file.
3. Choose **TLS**:
   - **Verify certificate** (recommended),
   - **Encrypt, don't verify** for self-signed certificates,
   - **No TLS** only on a trusted network.
4. **Test connection** shows the server version and latency.
5. **Switch and restart** applies migrations (under a lock, so several apps
   can switch at once) and restarts Core on the new database.

The status card shows the current target and its state (Connected,
Starting, Unavailable, Stopped). Switching back to **Local** works the same
way; the local data is still there.

## What is shared, and what isn't

- **Shared** (in the database): agents, workflows, versions, runs, threads
  and their checkpoints, chats, triggers, workspace settings (allowed
  folders, guardrails, MCP server configs, skills, Jira site).
- **Per machine** (in your Keychain): secrets: provider keys, GitHub and
  Jira tokens, MCP secrets. Each person signs in to their own CLIs and
  accounts. MCP secrets are referenced by name, so each person stores the
  same names.
- **Per machine** (files): logs, scratch folders, worktrees.

A run is claimed by one app at a time, and each scheduled or polled trigger
fires once across all apps. If an app quits mid-run, another app picks the
run up from its last checkpoint once its lease expires. Live progress
streams from the app that runs the run; other apps see the stored events
when they open the run.

## Back up and restore the local database

**Settings → Database → Backup** (local database only):

- **Back up…** saves the whole local database to one `.tar.gz` file.
- **Restore…** replaces it with a backup, after you confirm. Changes made
  since that backup are replaced; the database you had is kept in
  `postgres/data.before-restore` until the next restore. If the backup
  doesn't start, the app puts your database back and says why.

Both stop the database for a few seconds; running work pauses and resumes.
A backup holds everything (chats, runs, settings), unencrypted: keep it
somewhere safe. A backup only restores into the same Postgres major
version (the app tells you if it doesn't match).

## Moving data

Switching does not copy data. To move agents and workflows, **export**
them (⋯ → Export as JSON or YAML) from one database and **import** them on
the other. Run history stays where it ran.

## Accounts and sign-in

- **Local database:** the app signs you in automatically, as before. To
  have an account (for a team DB or `agentic login`), open
  **Settings → Account → Create account**: your agents, workflows, and
  chats stay yours. Once you have one, you can turn off **Sign in
  automatically** there, and the app asks for your password at launch.
- **Team database:** everyone signs in. The app shows **Create your
  account** on a database without accounts and **Sign in** otherwise.
  The first account owns the workspace, so the person setting up the
  database should sign up first; later accounts join as members of the
  same shared workspace.
- **Members:** Settings → Account lists everyone. Owners can make others
  owners or members and remove them (their sessions end at once).
  Members can use and change everything else in the workspace.
- **Sessions** last 30 days and renew while you use the app. **Sign out**
  is on Settings → Account. The session is kept in the Keychain.

Anyone who has the connection string can create an account, and can read
the database directly anyway, so treat a shared database as trusted by
everyone who can connect to it.

Next: [Command line](cli.md).
