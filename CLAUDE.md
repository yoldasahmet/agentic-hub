@AGENTS.md

# CLAUDE.md

Claude agents follow `AGENTS.md` first. This file only adds Claude-specific notes.

## Every task

- Read `ROADMAP.md` before you start. Work on the **Current focus** step unless
  the user asks for something else.
- When a step is done and verified, tick it in `ROADMAP.md`, update the
  Status table and **Current focus**, and commit that with the work.
- Work only in this checkout. Treat the reference web app as read-only.

## Focus

- Prefer narrow edits and concise summaries.
- Use structured search (`rg`) before reading whole directories.
- When porting from the reference repo, check the **Reuse list** in
  `docs/reference-review.md` first.
- Before any UI work, check the component catalog in `docs/design-system.md`.
- Before adding a package or module, check the layers in `docs/architecture.md`.

## Verification

- Run `pnpm check-types`, `pnpm lint`, and the tests of the packages you
  touched (`pnpm vitest run packages/<pkg>`) after TypeScript changes.
- Mention any skipped verification with the reason.
