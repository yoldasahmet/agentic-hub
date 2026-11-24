# Agents

An agent is one step of work with typed **inputs** and **outputs**. Agents
are data: there is no special code per role, so a "reviewer" and a "coder"
differ only in their prompt, model, and tools. Each agent has its own color
and icon, which follow it everywhere (lists, canvas, chat, runs).

## Kinds

| Kind | What it does |
| --- | --- |
| **LLM** | Renders its prompt, calls a model, and checks the answer against the output schema. It can use tools. |
| **Tool** | Calls one registered tool (for example `github.pr.create`) with its inputs. |
| **Human** | Asks a person. The run pauses at a gate until someone answers in the Inbox, the run view, or chat. |

## The editor

The editor autosaves a **draft** as you type. Tabs:

- **Inputs & outputs.** Add fields with a name, type, description, and
  whether they are required. An agent with no output fields answers in free
  text (stored as `{ text }`). **Show as** picks how the output renders:
  Markdown, JSON, plan, diff, HTML, or table. For full control, edit the
  JSON Schema directly.
- **Prompt.** A system prompt and a user message template.
  `{{input.<field>}}` inserts an input (type `{{` for completion). An empty
  template sends all inputs as JSON. **Preview** shows the rendered prompt
  with sample inputs.
- **Runtime.**
  - **Model** plus optional reasoning effort and up to four **fallbacks**,
    tried in order when a model call fails (not when its answer is invalid).
  - **Timeout** (default 10 minutes) and **repairs**: when an answer doesn't
    match the output schema, it is sent back to the model up to this many
    times (default 2).
  - **Working directory** for CLI models and tools: **Private scratch** (a
    fresh folder per run, the default), **Fixed folder**, a folder from an
    **input**, or a **git worktree** per run made from a repository input
    (`owner/name` from GitHub, or a local repo path). Fixed and input folders
    must be inside an allowed folder (Settings → Tools).
  - **Capabilities:** tools, MCP servers, and skills by name, plus the
    **approval policy** (see [Integrations](integrations.md#tools-and-approvals)).
  - For a **Tool** agent: the tool to call.

## Playground

The **Playground** runs the draft or any published version with inputs you
type. You can save named **sample inputs** to rerun later. The result shows
the output in its format, the event stream (model attempts, thinking, tool
calls, errors), and usage. A human agent's question appears as a form to
answer right there. Recent runs are listed so you can open them again.

Editing the draft never changes a run that is already going: a draft run
uses a snapshot of the draft.

## Versions

- **Publish** freezes the draft as version 1, 2, 3, … Versions never change.
- Workflows pin agent versions (or follow `latest` in their draft), and
  chat always uses the latest published version.
- A draft can't be a chat target; publish first.

## More actions (⋯)

- **Export as JSON / YAML:** a bundle with the agent's identity and spec.
  Import it on another machine or workspace with **Import** on the Agents
  page.
- **Duplicate** makes an independent copy.
- **Archive** hides the agent from lists (the CLI shows archived agents
  with `--archived`). Existing workflow nodes still resolve it, and past
  runs stay intact.

Use **Library** to add a built-in or open the one already in your workspace.
Adding an archived built-in restores it with its edits and versions. Use
**Duplicate** from its editor to make a separate copy.

Next: [Workflows](workflows.md).
