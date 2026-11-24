# Chat

Every chat talks to a **target**: the **App**, one **agent**, or one
**workflow**. You can switch targets at any time without losing the
conversation.

## Targets

| Target | What happens when you send a message |
| --- | --- |
| **App** | A general assistant on the model you pick. It can find and run your agents and workflows, and read GitHub and Jira items. When it decides to run an agent or workflow, the turn continues as if you had picked that target. |
| **Agent** | The chat reads the agent's inputs from your message. If required inputs are missing, it asks with an **inputs card**. Then it runs the agent's latest published version. Follow-up messages refine the last answer. |
| **Workflow** | The same input handling, then the workflow runs inside the chat. Node progress shows inline, and its gates appear as approve/edit cards in the conversation. |

Only **published** agents and workflows can be chat targets.

## Starting and switching

- **New chat** (or `/new`) and pick a target, or just start typing to the App.
- Click the target chip at the top, type `@name` in the composer, or use
  **⌘K** to switch targets.
- Slash commands in the composer:

| Command | Does |
| --- | --- |
| `/app`, `/agent`, `/workflow` | Switch the target |
| `/cwd <path>` | Set the working directory (empty clears it) |
| `/title <text>` | Rename the chat |
| `/terminal` | Open or close terminal mode |
| `/new` | Start a new chat |
| `/archive` | Archive this chat |

**⌘↵** sends.

## Inputs cards

When a target needs inputs you didn't give, the chat shows a form with the
missing fields. Fill it and submit, or just send another message: a message
sent while the card waits answers the card. A first message to a target
with a single text input is used as that input directly.

## Gates in chat

A workflow's gates, a human agent's questions, and tool approvals show up as
cards in the conversation. They also appear in the **Inbox**, linked back to
the chat, so you can answer them from either place.

## The context panel

The right-hand panel shows the chat's:

- **Model** (for the App, or to override the agent's model),
- **Working dir**: the folder CLI models and tools run in. It must be inside
  an allowed folder (Settings → Tools); it is checked when you set it and on
  every message,
- **Git** status of the working dir, with a diff of uncommitted changes,
- **Usage**: tokens and cost so far.

## Attachments

Drop files onto the composer or use **Attach files**: small text files are
included, larger ones are referenced by path. **Attach a GitHub or Jira
item** adds an issue or pull request reference that the target can read.

## Terminal mode

`/terminal` (or the terminal button) opens an interactive session of a CLI
(Claude Code, Codex, Gemini, OpenCode) in the chat's working dir, with the
chat's MCP servers and skills attached where the CLI supports them. Nothing
is pre-approved there: the CLI asks in the terminal. Closing the window and
coming back re-attaches with the scrollback.

## History, state, and forks

A chat is a thread like any run. Open it in **Runs** to see each turn's
checkpoints, edit the state, or fork the conversation from an earlier point
(see [Runs and the Inbox](runs-and-inbox.md)).

Next: [Runs and the Inbox](runs-and-inbox.md).
