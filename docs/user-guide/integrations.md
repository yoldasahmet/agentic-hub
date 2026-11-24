# Integrations

## GitHub

### Connect

**Settings → GitHub** shows which credentials are in use. The app uses, in
order:

1. a token saved in the Keychain: paste a **personal access token**, or
   **Sign in with GitHub (device code)** with your OAuth app's client id,
2. otherwise the GitHub CLI's login (`gh auth login`).

GitHub Enterprise: set `AGENTIC_GITHUB_API_URL` for headless Core.

### In the app

The **GitHub** page lists issues and pull requests of a repository you
pick. Open one to read the conversation, comment, review a pull request
(comment, approve, request changes, line comments on the diff), or open a
**New pull request**. Jira keys in titles and bodies link to the issue.

### For agents

| Tools | Permission |
| --- | --- |
| `github.repo.get`, `github.issue.get`, `github.issues.list`, `github.pr.get`, `github.file.read`, `github.code.search` | read |
| `github.branch.create`, `github.push`, `github.pr.create`, `github.pr.merge`, `github.comment`, `github.review` | write |

An agent with the **git worktree** working dir gets its own checkout per
run, on branch `agentic/run-<id>`, cloned from `owner/name` (or made from a
local repo inside an allowed folder). The token reaches git through its
environment, never the command line or `.git/config`.

Chat's App target can read issues and pull requests. Workflows can start on
GitHub activity ([triggers](workflows.md#triggers)).

## Jira (Cloud)

### Connect

**Settings → Jira**: your **Site** (`https://your-team.atlassian.net`),
**Account email**, and an **API token** from
id.atlassian.com → API tokens. The token goes to the Keychain. Test the
connection on the same page.

### In the app

The **Jira** page lists issues by project or by a JQL query. Open one to
read and comment (Markdown, converted to Jira's format), change its status,
see sub-tasks and links, or create an issue.

### For agents

| Tools | Permission |
| --- | --- |
| `jira.issue.get`, `jira.search`, `jira.projects.list` | read |
| `jira.comment`, `jira.transition`, `jira.issue.create`, `jira.subtask.create`, `jira.link` | write |

When any pull request is opened through the app, it is linked on the Jira
issues its branch, title, or body names (`ABC-123`). Workflows can start
when issues match a JQL query ([triggers](workflows.md#triggers)).

## Tools and approvals

Every tool has a **permission level**: read, write, or dangerous. Built-in
tools:

| Tools | Permission |
| --- | --- |
| `fs.read`, `fs.list`, `git.status`, `git.diff`, `git.log`, `http.get` | read |
| `fs.write`, `git.commit`, `http.request` | write |
| `shell.run` | dangerous |

Each agent's **approval policy** says what happens per level: **allow**,
**ask**, or **deny**. The default is read → allow, write → ask, dangerous →
ask. "Ask" pauses the run once, before the model starts, with a tool
approval card listing the tools, the working dir, and the input. Approve
and the run continues; reject and it runs without those tools.

**Settings → Tools** has the workspace guardrails:

- **Allowed folders.** Tools, CLI agents, and chats only run in a run's
  private scratch folder, its worktree, or inside these folders. Empty by
  default, so reaching a repository is an explicit choice.
- **Timeout** per tool call (default 60 s) and an **output limit** (default
  64 KB; cut results say so).

Secret values the app knows (tokens, keys) are masked in tool output, run
events, and logs.

## MCP servers

**Settings → MCP servers** adds servers as a **Local command (stdio)** or a
**Remote URL (HTTP)**. Secrets for their env or headers are stored in the
Keychain by name. Each server lists its tools as `mcp.<server>.<tool>`;
their permission comes from the server's hints (read-only → read,
destructive → dangerous, otherwise write).

Attach a server to an agent under **Capabilities**. Claude Code and Codex
run attached servers themselves, limited to the tools the policy allows;
other providers call them through the app.

## Skills

**Settings → Skills** holds reusable instructions: Markdown **written
here**, or a **folder with SKILL.md** (read each time it is used). Attach
skills to an agent; their text is added to its system prompt.

## Secrets

**Settings → Secrets** lists everything in the Keychain vault by name.
Values are write-only: you can replace or delete them, never read them back
in the app.

Next: [Team database](team-database.md).
