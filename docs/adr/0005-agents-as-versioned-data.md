# ADR 0005: Agents as versioned data on the LangGraph host

- **Status:** accepted (Phase 6, 2026-10-10)
- **Relates to:** D4 (LangGraph host), D7 (contracts), D10 (versioned documents), R7, R8, R14, P6.1–P6.8
- **Amended by:** ADR 0009 §4 (the `worktree` working-dir policy), ADR 0014 §2 (working dirs must be in scratch, a worktree, or an allowed folder)

## Context

Agents must be data: an identity, an autosaved draft, and immutable
published versions that runs pin. The reference repo mixed role-specific
code into its runners (R7), composed agents in two ways (R8), and seeded
built-ins from TypeScript (R14). The LangGraph host from Phase 4 only knew
graphs registered in code at startup, but agents are created at run time,
possibly by another app instance on a shared team DB.

## Decision

1. **One spec, three kinds.** `AgentSpec` (contracts) holds the kind
   (`llm`, `tool`, `human`), input and output JSON Schemas, the output
   format, the prompt (system + `{{input.x}}` template), the runtime
   (model, reasoning, fallbacks, working-dir policy, timeout, repair
   rounds, tool) and capability slots (tools, MCP servers, skills, by
   name). The draft and every version have this shape. A version is a row
   in `agent_versions`; publishing locks the agent row, so version numbers
   never collide. Draft saves carry a `revision` (optimistic lock).
2. **Assistants resolved on demand.** `AssistantRegistry` gains
   `AssistantSource`s. Core's agents module registers one that resolves
   `agent:<id>` (version N, read from `agent_versions`) and
   `agent-draft:<id>` from the DB on a cache miss, so a version published
   elsewhere runs here too. `latest()` takes the workspace and refuses
   agents of another workspace, archived agents, and unpublished ones.
   Registry lookups became async.
3. **Draft runs carry their spec.** A draft run snapshots the draft into
   the run input (`spec`), and the draft graph reads it from state. Edits
   to the draft never change a running test, and a thread's checkpoints
   always explain what ran.
4. **One generic node.** `packages/agents` builds a one-node graph
   (`agent`). The `llm` kind renders the template, calls the model through
   the provider registry, validates against the output schema
   (`callStructured`: native schema or extraction, repaired up to
   `maxRepairs`), and falls back to the next model only when a call fails,
   not when its answer is invalid. A run-level model override replaces the
   model and fallbacks (to compare providers). The `human` kind raises an
   `interrupt` with the question and output schema and asks again with the
   issues when an answer doesn't match. The `tool` kind calls a
   `ToolInvoker`; until the tool registry lands (P9.1), Core's invoker
   reports that no tools are registered. LLM text deltas are merged into
   ~400-char / 150 ms chunks before becoming `custom` run events, since
   every event is persisted.
5. **I/O editing is lossless.** The editor's field model converts to and
   from JSON Schema with editor keywords: `x-ui-type` per property and
   `x-ui-order` for field order, because Postgres `jsonb` re-sorts object
   keys. `withoutUiKeywords` strips `x-ui-*` before a schema reaches a
   provider, since Claude Code validates `--json-schema` in strict mode.
6. **Library as bundles.** Built-ins are JSON bundles in
   `packages/agents/builtins/` (`format: agentic.agent`, `formatVersion: 1`),
   the same format as export and import (JSON or YAML, parsed in Core).
   Installing or importing goes through the normal create path, so slugs
   stay unique per workspace.

## Consequences

- Agents and, in P7, workflows plug into the same host without
  registration at startup or broadcasts between instances.
- Output edits in the playground are LangGraph state updates written as
  the `agent` node, so the checkpoint history shows them.
- JSON fields have no sub-schema in the editor; an imported schema with
  nested shapes keeps them until its fields are edited in the UI.
- Saved playground inputs live in `settings` under
  `agent:<id>:test-inputs`, scoped by workspace.
