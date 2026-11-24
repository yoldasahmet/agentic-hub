# Changelog

All notable changes to Agentic Hub. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). The app and the
`agentic` CLI share one version. `node scripts/release.mjs version <x.y.z>`
moves **Unreleased** under a new version heading (see `docs/release.md`).

## [Unreleased]

- Rename the app and repository to Agentic Hub and refresh the agent and SDLC screenshots.

The first release (0.1.0) of the macOS app.

### Added

- **Agents**: versioned agents (LLM, tool, human) with their own inputs and
  outputs, prompt templates, model and fallback chain, a playground, and a
  library with import/export.
- **Workflows**: a canvas to wire agents into graphs with branches, loops,
  parallel steps, human gates, and subworkflows, compiled to LangGraph;
  run views, retry, fork, compare, templates, and schedules.
- **Chat**: pick the App, an Agent, or a Workflow as the target; inline
  input cards and gates, attachments, and a terminal mode.
- **State**: every run and chat is a thread on the embedded LangGraph
  server, which you can inspect, edit, resume, and fork.
- **Providers**: Claude Code, Codex, Gemini CLI, and OpenCode through their
  CLIs, and OpenRouter through its API.
- **Integrations**: GitHub and Jira pages, agent tools, and triggers; MCP
  servers and skills.
- **Data**: a bundled local Postgres service by default, or a team database
  with sign-in; backup and restore of the local database.
- **CLI**: `agentic` (status, doctor, login, agents, workflows, runs,
  threads, serve), installable from the app menu.
- **Desktop**: first-run setup, structured logs with a viewer, and
  auto-updates from GitHub Releases.

### Fixed

- Source development and preview launches install the pinned Electron
  binary before electron-vite starts, avoiding `Electron uninstall` on a
  fresh checkout.
- Development startup keeps PostgreSQL's optional native driver lazy,
  so the JavaScript driver works without `pg-native` installed.
