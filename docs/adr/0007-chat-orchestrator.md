# ADR 0007: Chat as one orchestrator graph with targets as data

- **Status:** accepted (Phase 8, 2026-10-10)
- **Relates to:** D4 (LangGraph host), D6 (providers), D7 (contracts), R5, P8.1–P8.8
- **Amended by:** ADR 0014 §2 (a chat's working dir is checked against the allowed folders on set and on every message)

## Context

A chat talks to the App, an agent, or a workflow, and can switch targets
mid-conversation. Each chat must be a LangGraph thread (checkpoints are the
source of truth), ask for missing inputs inline, show workflow progress,
and answer workflow gates in the chat. The reference kept chat sessions as a
separate run system with its own message tables (R5).

## Decision

1. **One built-in assistant, `chat` v1.** Every chat is a thread of it. The
   target, model, and working dir are copied from the `chats` row into each
   run's input (`context`), so switching targets needs no new thread and no
   per-target assistant versions.
2. **Messages live in the thread state** (`messages`, merged by id). The
   `chats` table is only the index (title, target, model, working dir,
   `thread_id`). History, state edits, and forks come from the existing
   threads API.
3. **Graph:** `intake → (ask ⟲) → execute → respond`, plus `app`.
   - `intake` reads inputs from the conversation: a first message to a
     target with one text field becomes that field as is; otherwise the
     model fills what the person gave (structured output with every field
     optional) and refines the previous answer's inputs on a follow-up.
   - `ask` is an `interrupt` with a `chat.inputs` request (the inline
     `SchemaForm` card). The answer is the filled form, a new message
     (sending while the card waits resumes it), or a cancel.
   - `execute` runs the target's latest published version **as a subgraph
     inside the node** (compiled without a checkpointer, invoked with the
     node's config). Its custom events stream into the chat run, and its
     gates interrupt the chat run and resume where they left off. A failure
     becomes an error answer, so the chat continues.
   - `app` is a general assistant on the chat's model (or the workspace
     default). Tools use a text protocol (one fenced `tool` block with JSON)
     so they work on every provider, CLI or API: `find`, `run` (hands the
     turn to an agent or workflow through ask/execute), and `AppTool`s that
     integrations register (GitHub and Jira reads in P10.4/P11.4).
4. **Targets come from Core.** `packages/chat` defines `ChatTargets`; Core
   resolves the latest published version through the agents and workflows
   directories (workspace-checked) and caches compiled targets per version.
   Drafts are not chat targets: publish first.
5. **Attachments** are local file paths (inlined when small text, named by
   path otherwise) and GitHub/Jira references; integrations resolve item
   content later.
6. **Terminal mode** is a PTY session owned by Core (`/terminals`),
   started through `cli-bridge` (`openCliTerminal`) with the same command
   lookup, env allowlist, and cwd check as headless runs. Output and
   keystrokes travel over the existing WebSocket; sessions keep 256 KB of
   scrollback, so a reconnecting renderer re-attaches.

## Consequences

- A chat run is an ordinary run: it shows in Runs, gates show in the Inbox
  (linked to the chat), and reconnect replay is the run-events replay.
- The parent `execute` node re-runs on resume; only the subgraph's own
  checkpoints keep its progress, so nothing before `invoke` may have side
  effects.
- Extraction costs one structured call per message to multi-field targets;
  it is not yet added to the turn's usage report.
