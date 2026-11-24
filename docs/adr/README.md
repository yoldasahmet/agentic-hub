# Architecture decision records

Each ADR records one significant decision: its context, the decision, and
the consequences. ADRs are not rewritten when a later decision changes
them; the later ADR says what it amends, and the earlier one gets an
**Amended by** line. `docs/architecture.md` always describes the current
state.

| ADR | Decision | Phase | Amended by |
| --- | --- | --- | --- |
| [0001](0001-desktop-ipc-and-secrets.md) | Desktop IPC envelope and write-only secrets | 2 | — |
| [0002](0002-local-postgres-and-db-switching.md) | Local Postgres service and database switching | 3 | 0003 |
| [0003](0003-embedded-core-and-graph-runtime.md) | Embedded Core and the LangGraph runtime | 4 | 0014, 0015 |
| [0004](0004-llm-providers-and-cli-bridge.md) | LLM providers and the CLI bridge | 5 | 0014 |
| [0005](0005-agents-as-versioned-data.md) | Agents as versioned data on the LangGraph host | 6 | 0009, 0014 |
| [0006](0006-workflows-compiled-to-langgraph.md) | Workflows as pinned documents compiled to LangGraph | 7 | — |
| [0007](0007-chat-orchestrator.md) | Chat as one orchestrator graph with targets as data | 8 | 0014 |
| [0008](0008-tools-mcp-and-skills.md) | Tools, MCP servers, and skills | 9 | 0010, 0014 |
| [0009](0009-github-integration.md) | GitHub integration | 10 | — |
| [0010](0010-jira-integration.md) | Jira integration | 11 | — |
| [0011](0011-agentic-cli.md) | The `agentic` CLI | 12 | 0015, 0016 |
| [0012](0012-structured-logging.md) | Structured logging | 13 | — |
| [0013](0013-testing.md) | Testing | 14 | — |
| [0014](0014-security-model.md) | Security model | 15 | — |
| [0015](0015-basic-auth.md) | Basic user auth | 17 | — |
| [0016](0016-macos-packaging-and-release.md) | macOS packaging and release | 18 | — |

## Writing a new ADR

1. Copy the shape of a recent ADR: title `# ADR NNNN: <decision>`, then
   **Status** (`accepted (Phase N, YYYY-MM-DD)`), **Relates to** (key
   decisions D1–D13, review findings R*, roadmap steps), and **Amends** when
   it changes an earlier ADR.
2. Sections: **Context**, **Decision** (numbered, so others can cite
   `ADR NNNN §k`), **Consequences**.
3. Add an **Amended by** line to every ADR it amends, a row here, and
   update `docs/architecture.md` (and the Key decisions table in
   `ROADMAP.md` if a D-decision changes).
