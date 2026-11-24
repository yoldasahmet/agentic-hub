# Command line

`agentic` drives the app from a terminal: list and run agents and
workflows, follow runs, answer gates, and edit thread state. It talks to
the same Core the app uses, so everything shows up in the app too.

## Install

In the app menu choose **Install Command Line Tool…**. It links `agentic`
into `/usr/local/bin` when that is writable, otherwise `~/.local/bin` (add
it to your `PATH` if needed). The installed command runs on your own
**Node.js 22 or later** (`brew install node`); `agentic doctor` checks it.
From a source checkout, run `apps/cli/bin/agentic.mjs`.

## Finding Core

`agentic` connects to the running app automatically: Core writes a private
runtime file (`runtime/core.json`) with its address and per-launch token,
and the CLI reads the newest live one. Other options:

- `--data-dir DIR` reads the runtime file from another data folder,
- `AGENTIC_URL` + `AGENTIC_TOKEN` connect to a Core started elsewhere
  (add `AGENTIC_SESSION` for a team DB).

On the local database the CLI acts as you without signing in (while auto
sign-in is on). A team database, or a headless Core, needs
`agentic login` first: it asks for your email and password (or reads the
password from stdin with `--password-stdin`) and keeps the session in
`<data dir>/cli/session.json`, readable only by you. `agentic logout`
ends it. A command that needs a sign-in says so.

`agentic doctor` checks that Core is reachable and healthy and that model
providers are detected and signed in. `agentic status` prints Core's
address, version, uptime, who you act as, and how many runs are running
or waiting at a gate.

## Commands

```text
agentic status [--json]
agentic doctor [--json]
agentic login [--email EMAIL] [--password-stdin] [--json]
agentic logout [--json]
agentic agents list [--archived] [--json]
agentic agents run <id|slug> [-i key=value]… [--input-json '{…}'] [--version draft|N]
                   [--model provider/model] [--detach] [--json]
agentic workflows list [--archived] [--json]
agentic workflows run <id|slug> [-i key=value]… [--input-json '{…}'] [--version draft|N]
                      [--detach] [--json]
agentic workflows resume <run-id> --approve | --reject | --answer '<json>'
                      [--data '{…}'] [--comment text] [--interrupt id] [--detach] [--json]
agentic runs list [--status S] [--limit N] [--json]
agentic runs logs <run-id> [--follow] [--json]
agentic threads state get <thread-id> [--json]
agentic threads state set <thread-id> --values '{…}' [--as-node node] [--checkpoint id] [--json]
agentic serve [--data-dir DIR] [--json]
```

`agentic <command> --help` prints one command's usage.

## Runs and exit codes

`agents run` and `workflows run` follow the run live until it ends or
waits at a gate. `--detach` returns the run id right away. Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | The run succeeded |
| 3 | The run waits at a gate: answer it with `workflows resume` or in the app's Inbox |
| 1 | The run failed or was canceled, or the command failed |

`--json` prints machine-readable output for scripts and CI.

Example:

```sh
agentic workflows run pr-review -i title="Add retries" \
  --input-json "$(git diff main | jq -Rs '{diff: .}')"
agentic workflows resume <run-id> --approve --comment "Looks good"
```

## Headless Core

`agentic serve` runs Core under Node without the app, until Ctrl-C. It
writes the same runtime file, so the other commands find it. Configure it
with environment variables:

| Variable | Purpose |
| --- | --- |
| `AGENTIC_DATABASE_URL` | Postgres connection string (required) |
| `AGENTIC_DB_TLS` | `verify-full`, `require`, or `disable` |
| `AGENTIC_DATA_DIR` | Data folder (default `~/.agentic`) |
| `AGENTIC_OPENROUTER_API_KEY`, `AGENTIC_OPENROUTER_BASE_URL` | OpenRouter key and an optional gateway |
| `AGENTIC_GITHUB_API_URL` | GitHub Enterprise API URL |
| `AGENTIC_SECRET_GITHUB_TOKEN`, `AGENTIC_SECRET_JIRA_TOKEN`, `AGENTIC_SECRET_MCP_<NAME>` | Secrets the app would keep in the Keychain |
| `AGENTIC_LOG_DIR`, `AGENTIC_LOG_LEVEL` | Log folder (default `<data dir>/logs`) and level |

Next: [Troubleshooting](troubleshooting.md).
