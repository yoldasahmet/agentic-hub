# ADR 0008: Tools, MCP servers, and skills

- **Status:** accepted (Phase 9, 2026-10-10)
- **Relates to:** D6 (providers), D8 (secrets), R7, P6.4–P6.5, P9.1–P9.4
- **Amended by:** ADR 0010 §4 (`ToolContext.workspaceId`), ADR 0014 §2–3 (one working-dir rule for CLI agents too; run events scrubbed)

## Context

Agents had capability slots (tools, MCP servers, skills) by name since
Phase 6, and the `tool` kind called a `ToolInvoker` with nothing behind it.
Phase 9 needs real tools with permission levels and approvals, MCP servers
over stdio and streamable HTTP, skills, and guardrails, on every provider:
CLIs that run their own tools (Claude Code, Codex), CLIs that don't (Gemini,
OpenCode), and OpenRouter.

## Decision

1. **`packages/tools` (layer 2).** A `ToolRegistry` of in-process tools
   declared with Zod (`defineTool`; the JSON Schema comes from the Zod
   input). Built-ins: `fs.read|list|write`, `git.status|diff|log|commit`,
   `shell.run`, `http.get|request`. Each tool has a permission level
   (`read`, `write`, `dangerous`). Integrations register theirs on the same
   registry (P10.4, P11.4). Commands run through `cli-bridge`'s new
   `runProcess` (same PATH lookup, filtered env, process group, timeout).
2. **MCP client.** `@modelcontextprotocol/sdk` over stdio or streamable
   HTTP. Stdio servers get the CLI env allowlist plus their own env.
   `McpPool` keeps one connection per server (reconnects on a config change,
   closes after 5 idle minutes). MCP tools are named
   `mcp.<server>.<tool>`; their permission comes from annotations
   (`readOnlyHint` → read, `destructiveHint` → dangerous, else write).
   Server configs live in `mcp_servers.config` with secrets as vault names
   (`secretEnv`, `secretHeaders`); main hands `mcp.*` vault entries to Core
   with the provider keys (headless: `AGENTIC_SECRET_MCP_*`).
3. **One `Toolbox` per Core.** It resolves an agent's slots in the run's
   workspace (`configurable.workspace_id`, set by the run executor and
   inherited by subgraphs): tool names (`git.*` takes a group), server
   names (all their tools), and skill slugs. It invokes tools under the
   guardrails and masks secrets. Unknown names fail the run with a clear
   error instead of silently dropping a capability.
4. **Approvals are interrupts, asked before side effects.** The policy
   (per agent, per permission level: allow / ask / deny; default read
   allow, write and dangerous ask) is part of `capabilities.approval`. A
   `tool` agent asks for its one call with the input. An `llm` agent asks
   once per run for all its `ask` tools **before the first model call**, so
   resuming never repeats a model or tool call; rejecting runs without
   them. The request kind is `tool.approval`; `GateCard` renders it, so the
   Inbox, run views, and chat get it for free.
5. **Tool use is provider-neutral, with native MCP where it exists.** The
   fenced `tool` block protocol (from the chat App, now in
   `packages/tools`) drives a loop in `llm` agents: up to 24 rounds, tool
   results as user messages, and the output schema applied in one final
   structured call. Providers with native schema support choose their next
   tool or final answer in a structured response. CLIs with their own MCP
   client (`capabilities.mcp`:
   Claude Code, Codex) get the attached servers natively: Claude Code via a
   0600 `--mcp-config` file with `--strict-mcp-config` and `--allowedTools`
   set to the granted tools; Codex via `-c mcp_servers.*` overrides with
   `enabled_tools`. Everything else goes through the loop. Each call is a
   `tool` run event.
6. **Skills** are inline Markdown or a folder with a `SKILL.md` (read on
   each use, frontmatter dropped), appended to the system prompt.
7. **Guardrails** (workspace setting `tools:guardrails`): tools run only in
   the scratch dir or inside allowed folders (symlinks resolved), file
   paths must stay inside the working dir, every call has a deadline
   (default 60 s) and an output budget (default 64 KB, cut results say so),
   and known secret values plus common token shapes are masked in tool
   results and in the final output of agents with tools.
8. **Terminal sessions** take MCP servers and skills too: Claude Code gets
   `--mcp-config` and `--append-system-prompt`, Codex the server overrides.
   Nothing is pre-approved there; the CLI asks in the terminal.

## Consequences

- The allowlist is opt-in: a repo is reachable by tools only after it is
  added in Settings → Tools. Agents on the scratch dir work out of the box.
- A CLI running MCP natively returns tool output we can't filter before the
  model sees it; final output is masked, streamed text is not.
- For host tool rounds, Codex starts with the user config, bundled connectors,
  plugins and native shell disabled. The app supplies the approved tools.
- Codex receives MCP secrets through its child environment. Its command
  arguments name the variables needed by each server.
- Gemini and OpenCode use MCP through the app (the loop), so approvals and
  guardrails apply in full there.
