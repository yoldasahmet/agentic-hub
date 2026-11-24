# ADR 0006: Workflows as pinned documents compiled to LangGraph

- **Status:** accepted (Phase 7, 2026-10-10)
- **Relates to:** D4 (LangGraph host), D7 (contracts), D10 (versioned documents), D11 (job queue), R5, R8, R13, R14, P7.1–P7.10

## Context

Workflows compose agents into graphs with branches, loops, parallel
steps, human gates, and subworkflows. They must run on the embedded
LangGraph host like agents do (ADR 0005), be editable without raw JSON
(R13), and stay correct on a shared team DB. The reference stored nodes and
edges as rows, kept its own checkpoint table (R5), and recompiled from
mutable rows, so a run could change under an edit.

## Decision

1. **One document per version.** `WorkflowDocument` (contracts) holds the
   I/O schemas, an output mapping, nodes (`agent`, `workflow`, `gate`), and
   edges. Node ids are short (`[a-z][a-z0-9_]*`) because they are LangGraph
   node names and `nodes.<id>` paths in conditions; `__` is reserved. A
   node references an agent or subworkflow at `latest` or a fixed version.
   Bindings (input field, node output field or whole output, literal,
   JSON-logic expression, plus an optional fallback) fill each input.
2. **Pinned before it runs.** Publishing validates the draft (errors block)
   and replaces every `latest` with the newest published version, so a
   version never changes. A draft run does the same and stores the result in
   `workflow_snapshots`, one row per draft revision; it runs as
   `workflow-draft:<id>` at version = revision + 1. A referenced agent or
   subworkflow must be published (`agent_unpublished`): workflows run
   pinned versions, while the agent playground is for drafts.
3. **Validation lives in `packages/workflows`, catalog from Core.** The
   validator is pure and keeps the reference's stable codes, plus codes for
   versions, subworkflow cycles, gates, and the output mapping. Core loads
   the catalog (the schemas of each referenced target at its pin, and which
   workflows a subworkflow reaches) and returns the issues with every
   autosave, which is the editor's live validation panel.
4. **Compiler semantics** (`buildWorkflowGraph`):
   - channels: `input`, `nodes` (status, output, run count, report per
     node), `overrides` (reviewed inputs), `output` (re-mapped after every
     node); `nodes` and `output` merge, so parallel branches never collide;
   - every outgoing edge whose condition holds is followed (parallel
     fan-out); a node with several incoming edges and `join: all` is a
     deferred LangGraph node, so it runs once after every running branch;
   - a loop edge (`maxIterations`) is followed while its target has run at
     most that many times. The count lives in state, so editing state or
     forking keeps loops consistent;
   - review before or after a node compiles to its own graph node
     (`<id>__input`, `<id>__output`) that interrupts, so resuming a review
     never re-runs the agent;
   - agent nodes run the agents package's generic node (the same code as
     the playground); gates interrupt with their bound data and accept
     approve (optionally edited, validated against the gate's fields) or
     reject (`stop` fails the run, `continue` records `approved: false`);
   - subworkflows compile the same way and run as subgraphs inside their
     node, on the parent's checkpointer, so their gates pause the parent.
5. **Several gates at once.** Parallel branches can wait together. A resume
   may name its `interruptId` (`Command({ resume: { [id]: value } })`), and
   the host reports only interrupts of tasks that haven't finished:
   LangGraph keeps an answered task's old interrupt write until the whole
   step completes.
6. **Retry and fork.** Retrying a failed run continues its thread, which
   re-runs the failed node. Retrying from a node forks the thread at the last
   checkpoint before that node, without the step's pending writes, so the
   step runs again from scratch. Forking any checkpoint stays in the
   StateInspector (Phase 4).
7. **Templates and triggers are data.** Templates are bundles in
   `packages/workflows/templates/*.json` (JSON like the agent built-ins
   rather than the YAML the reuse list suggested, so they bundle into Core
   with the same import). Agents are referenced by slug; installing one
   adds and publishes the built-ins it needs. A bundle can also carry its
   own agents, the inline skills they name, and MCP servers; missing ones
   are created on install (servers disabled, so a person reviews a command
   before it runs) and existing ones are reused. Manual and scheduled triggers
   are `triggers` rows; a throttled sweep on the worker tick claims due
   schedules with `SKIP LOCKED`, advances `next_fire_at`, and enqueues a
   `trigger.fire` job in the same transaction, so each due time fires once
   across app instances.

## Consequences

- A run always explains itself: its version (or snapshot) is immutable,
  and the run view loads the exact document it ran.
- Workflows can only use published agents. Editing an agent means
  publishing it before a workflow picks it up at `latest`.
- Retrying from a node re-runs the other branches of that step too.
- Draft snapshots accumulate one row per revision that was run; a retention
  job can prune old ones with the run retention work.
