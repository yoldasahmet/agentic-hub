# Troubleshooting

## Logs and diagnostics

- **Settings → Logs** shows the logs of both the app (`main.log`) and Core
  (`core.log`), live, with filters by level, module, and text. It works even
  while Core is down. **Open folder** opens `~/Library/Logs/Agentic Hub`.
- Error toasts have a **View logs** button that filters to that request's
  trace id.
- **Copy diagnostics** builds a report with versions, database and Core
  status, and recent problems. Secrets are removed from it and from every
  log line, so it is safe to paste into an issue.
- More detail: start the app (or `agentic serve`) with
  `AGENTIC_LOG_LEVEL=debug`.

## Common problems

| Symptom | What to do |
| --- | --- |
| "Core is starting" never ends, or the status bar shows Core red | Open Settings → Logs, filter by `core`. A database problem usually shows there; check Settings → Database. |
| Database **Unavailable** | Local: quit and reopen the app (it restarts its Postgres). Remote: **Test connection**, check the network, credentials, and TLS mode. |
| The CLI says "Sign in to continue" or "Your session has expired" | Run `agentic login` (a team DB or headless Core needs it). |
| Forgot your password | There's no password change or reset yet (it's on the roadmap backlog). Until then, keep **Sign in automatically** on for the local database. |
| A CLI shows as not detected | Make sure it runs in a new Terminal window (`claude --version`). The app reads your login shell's `PATH`. Restart the app after installing. |
| A CLI is detected but not signed in | Sign in with the CLI itself (`claude auth login`, `codex login`, `opencode auth login`, or Gemini's sign-in), then refresh Settings → Providers. |
| `tool.dir_denied` (403): the folder is not allowed | Add the folder (or a parent) in **Settings → Tools → Allowed folders**. Applies to agents' working dirs, chat working dirs, and tools. |
| A run waits forever | It is probably at a gate: check the **Inbox**. |
| An agent's answer "doesn't match the output schema" | Make the prompt describe the fields, raise **repairs**, or use a model with native structured output (Claude Code, Codex, OpenRouter). |
| GitHub calls fail with 401 | Re-enter the token in Settings → GitHub, or run `gh auth login` again. |
| Jira calls fail with 401 | Check the site URL and account email, and create a new API token. |
| A trigger doesn't fire | It must be enabled and point at a **published** version. The Triggers tab shows its last error. |
| `agentic` says it needs Node.js 22 | Install Node 22 or later (`brew install node` or nodejs.org) and open a new terminal. The app's CLI runs on your Node. |
| macOS says Agentic Hub can't be opened | Unsigned builds: right-click Agentic Hub in Applications → Open, then Open. |
| A restore fails | The app restarts your previous database and shows the reason. A backup only restores into the same Postgres major version. |
| `agentic` can't find Core | Start the app or `agentic serve`, or pass `--data-dir`. `agentic doctor` explains what it tried. |

## Reporting a bug

Use **Copy diagnostics**, then describe what you did and what you expected.
Include the trace id from the error toast if there was one.
