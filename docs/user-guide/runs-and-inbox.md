# Runs and the Inbox

Every agent run, workflow run, and chat turn is a **run** on a **thread**
of the app's built-in LangGraph server. The state after each step is saved
as a **checkpoint**, so a run survives an app restart and can be inspected
or changed afterwards.

## Runs page

**Runs** lists every thread, most recently updated first, with its status
(Idle, Running, Needs input, Failed). Select one to see:

- the latest run: status, its open gates, and **Cancel** while it runs,
- the **state inspector**: a timeline of checkpoints, the state as JSON,
  and a diff between checkpoints.

From the inspector you can:

- **Edit state.** Change a value and save it as a new checkpoint. If the
  run is waiting at a gate, it continues from your edit and the gate asks
  again with the new values.
- **Fork.** Start a new thread from any checkpoint. The original stays as
  it was. A fork (or a thread you edited after its run ended) shows a
  **continue** card to pick it up from its latest checkpoint.

Agent and workflow runs also have their own views: the agent
**Playground** and the workflow **run view** (see [Workflows](workflows.md#running)).

## The Inbox

**Inbox** collects everything that waits for a person, across all runs:

| Request | Answer with |
| --- | --- |
| Workflow gate | Approve, edit the fields, or reject, with an optional comment |
| Input or output review | Approve as is, edit, or reject |
| Human agent question | A form matching the agent's output |
| Tool approval | Approve or reject the listed tools (with their working dir and input), with a note |
| Chat inputs | Shown in the chat; the Inbox links to it |

Answering resumes the same run: it does not start a new one, and nothing
that already ran is repeated. "Nothing needs you" means the Inbox is empty.

## Recovery

Runs are queued jobs with leases. If the app quits or crashes mid-run, the
run continues from its last checkpoint the next time Core starts (or, on a
team DB, on another running app once the lease expires). Finished nodes
never run twice.

Next: [Integrations](integrations.md).
