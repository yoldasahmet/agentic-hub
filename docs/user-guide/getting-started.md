# Getting started

## Install

Download the `.dmg` for your Mac (`arm64` for Apple silicon, `x64` for
Intel) from the release, open it, and drag **Agentic Hub** to Applications.
Until releases are signed, open it the first time with right-click → Open.
Signed releases update themselves. Agentic Hub checks at launch and every six
hours, downloads in the background, and installs when you quit
(**Agentic Hub → Check for Updates…** checks now).

## First launch

On first launch the app starts its own **local Postgres** (bundled, no
Docker), applies migrations, and starts **Core**, the built-in backend. The
status bar at the bottom shows both. "Core is starting" in a page means it
is still coming up; if it stays red, open **Settings → Logs** (see
[Troubleshooting](troubleshooting.md)).

The first launch opens **Welcome to Agentic Hub**, a short setup: the
database, the model CLIs found on your Mac and an optional OpenRouter key,
GitHub and Jira, and starter workflows. Every step can wait; **Skip for
now** closes it, and **Settings → General → Open first-run setup** brings
it back.

Your data stays in `~/Library/Application Support/Agentic` across the rename. Logs are in
`~/Library/Logs/Agentic Hub`. Nothing is sent anywhere except to the model
providers, GitHub, and Jira you configure.

## Connect a model provider

Agents and chat call models through the CLIs you already use, or through
OpenRouter.

| Provider | What you need |
| --- | --- |
| Claude Code | `claude` installed and signed in (`claude auth status`) |
| Codex | `codex` installed and signed in (`codex login status`) |
| Gemini CLI | `gemini` installed, with an API key in your env or a cached Google sign-in |
| OpenCode | `opencode` installed and signed in (`opencode auth login`) |
| OpenRouter | An API key, pasted in **Settings → Providers → OpenRouter API key** |

Open **Settings → Providers**. Each CLI shows whether it was **detected**,
its version, and whether it is signed in. The app finds CLIs on your login
shell's `PATH`, so tools installed with Homebrew, npm, or `~/.local/bin`
work even when the app was opened from Finder.

From the same page you can:

- turn models on or off for the workspace (OpenRouter's full list can be
  synced and is off by default),
- **Test** a prompt against one model, with optional thinking and a JSON
  Schema for structured output,
- **Compare** the same prompt across several models side by side.

The model called `default` leaves the choice to the CLI's own config.
Codex also offers explicit model choices, including GPT-6 Luna.
Availability depends on the CLI and the signed-in account. If the provider reports
`model_not_found`, check the detected Codex version and test the model in
**Settings → Providers**. The examples ran with Codex CLI 0.171.0-alpha.13.
When several Codex installations are present, put the directory containing
the desired executable first on `PATH` before starting `pnpm dev`.

## The window

- **Sidebar:** Chats, Agents, Workflows, Runs, Inbox, GitHub, Jira, Settings.
- **⌘K** opens the command palette: jump to any agent, workflow, chat, or
  page.
- **Status bar:** database and Core state. Click the Core indicator to open
  the logs.

## A first agent in two minutes

1. **Agents → New agent**, kind **LLM**. It starts with one `task` input
   and a free-text answer.
2. Pick a model on the **Runtime** tab.
3. Open **Playground**, type a task, and run it. The answer streams in,
   with model, tokens, cost, and duration.
4. **Publish** when you like it. Now it can be used in workflows and as a
   chat target.

Or start from **Agents → Agent library**, which has ready-made agents
(planner, coder, reviewer, tester, PR summarizer, Jira triager, and more),
and **Workflows → Workflow templates** (issue triage, GitHub issue → PR,
Jira issue → PR, PR review, an SDLC pipeline).

Next: [Agents](agents.md).
