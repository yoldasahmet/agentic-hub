@AGENTS.md

# GEMINI.md

Gemini agents follow `AGENTS.md` first. This file only adds Gemini-specific notes.

## Every task

- Read `ROADMAP.md` before you start. Work on the **Current focus** step unless
  the user asks for something else.
- When a step is done and verified, tick it in `ROADMAP.md`, update the
  Status table and **Current focus**, and commit that with the work.
- Work only in this checkout. Treat the reference web app as read-only.

## Defaults

- Use `rg` for repository discovery. Avoid broad file reads.
- Keep source files under 250 lines (aim for ≤150).
- Respect the package layers in `docs/architecture.md`. Reuse components from `docs/design-system.md`.
- Shared UI goes in `packages/ui`. Shared contracts go in `packages/contracts`.
