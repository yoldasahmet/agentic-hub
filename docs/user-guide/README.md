# User guide

Agentic Hub lets you build **agents**, compose them into **workflows**, and
use both from **chat**, from **GitHub and Jira**, on a **schedule**, or from
the `agentic` command line. Everything runs on your Mac. Each run is a
thread on a LangGraph server built into the app, so you can inspect it,
edit its state, resume it, and fork it.

| Page | What it covers |
| --- | --- |
| [Getting started](getting-started.md) | First launch, model providers, the window layout |
| [Agents](agents.md) | Kinds, inputs and outputs, prompts, models, tools, versions, the playground |
| [Workflows](workflows.md) | The canvas, bindings, branches, loops, gates, runs, triggers, templates |
| [Chat](chat.md) | App, Agent, and Workflow targets, inputs cards, gates in chat, terminal mode |
| [Runs and the Inbox](runs-and-inbox.md) | Watching runs, answering gates, editing state, forking |
| [Integrations](integrations.md) | GitHub, Jira, tools and approvals, MCP servers, skills |
| [Team database](team-database.md) | Local Postgres, switching to a shared team DB, moving data |
| [Command line](cli.md) | The `agentic` CLI and headless Core |
| [Troubleshooting](troubleshooting.md) | Logs, diagnostics, common errors |

## Words used in this guide

- **Agent:** one step of work: a model call (`llm`), a tool call (`tool`),
  or a question to a person (`human`). It has typed inputs and outputs.
- **Workflow:** a graph of agents, sub-workflows, and gates.
- **Draft / version:** agents and workflows autosave a draft. **Publish**
  freezes it as an immutable numbered version. Runs pin the version they
  started on.
- **Run:** one execution of an agent, a workflow, or a chat turn. It stays
  one run across all its pauses.
- **Thread:** the conversation-like history a run lives on. It holds every
  checkpoint (state snapshot).
- **Gate:** a pause where a person approves, edits, rejects, or answers.
  Open gates collect in the **Inbox**.
- **Workspace:** everything you create belongs to one. On a team DB, people
  in the same workspace share agents, workflows, and runs.
