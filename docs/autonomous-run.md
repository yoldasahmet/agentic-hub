# Autonomous run protocol

Use this workflow when a maintainer requests one roadmap phase per cloud
session.

## Working agreement

- Follow decisions D1–D13 in `ROADMAP.md`. Record architecture changes
  in `docs/adr/`.
- Work on a feature branch and follow the repository's normal contribution
  process.
- For verification that requires a local Mac, follow the roadmap's
  **Verify on Mac** convention.

## Environment facts (Linux cloud container)

- Node 22 and pnpm 10.28 are available. npm and GitHub downloads work.
- Only the `claude` CLI is installed. Codex, Gemini, and OpenCode are not.
  Test parsers with recorded fixture strings.
- `openrouter.ai` is blocked by the network policy.
- No macOS. For Electron, a headless run (`xvfb-run` if available) or a
  build plus typecheck is the most you can do.

## Steps for each session

1. Read `AGENTS.md`, `ROADMAP.md` (Current focus), and the docs the phase
   needs. Do only **your** phase.
2. Pull the latest `main` first (`git fetch origin main && git merge --ff-only origin/main`).
3. Check the CI result of the latest `main` commit (GitHub Actions). If it
   is red, fix it first.
4. Implement every step of the phase. Keep files small and reuse existing
   code.
5. Run `pnpm lint` and `pnpm check-types` (plus tests from Phase 14). Fix
   everything until they pass.
6. Update `ROADMAP.md`: tick steps, set the phase row, move Current focus
   to the next phase.
7. Commit the verified work. Push or merge only when authorized.
8. **Hand off** when requested. Call the `create_session` tool (claude-code-remote MCP;
   load it with ToolSearch if needed) with:
   - `source_url`: the GitHub URL of the current checkout
   - `title`: `Agentic Hub — Phase <N+1>`
   - `prompt`: `Run Phase <N+1> of ROADMAP.md following docs/autonomous-run.md.`
   Omit `permission_mode` and `environment_id` so they are inherited.
9. Stop after the hand-off. The final phase (18) does no hand-off. Also
   stop the chain if two phases in a row end with steps still **Blocked**,
   and write the reason at the top of `ROADMAP.md` under Current focus.
