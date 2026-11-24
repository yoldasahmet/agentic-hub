# ADR 0009: GitHub integration

- **Status:** accepted (Phase 10, 2026-10-11)
- **Relates to:** D8 (secrets), D11 (job queue), R2, ADR 0008, P10.1–P10.6
- **Amends:** ADR 0005 (adds the `worktree` working-dir policy)

## Context

Phase 10 connects GitHub as UI, as agent tools, as a source of triggers,
and as local git working copies. It must keep tokens out of Postgres, logs,
and the renderer (R2), stay correct on a shared team DB, and work without a
public webhook URL (a desktop app has none).

## Decision

1. **`packages/integrations/github` (layer 3)** on Octokit (`@octokit/rest`)
   with the throttling and retry plugins: primary and secondary rate limits
   wait when GitHub says how long (up to a minute, twice / once), 5xx
   retries twice, and errors map to app codes (`github.unauthorized`,
   `github.rate_limited`, `not_found`, `conflict`). Lists are pages with
   `hasMore` from the Link header; detail views use `paginate`. It may use
   `cli-bridge` (layer 1) for git and `gh`, so the layer map gains it.
2. **Auth: one token per app, resolved on each call.** The vault entry
   `github.token` (a fine-grained PAT, or a device sign-in) wins; otherwise
   `gh auth token` is read on demand (cached 5 minutes) and never stored.
   `github.*` vault names are integration secrets that main hands to Core
   like provider keys. **Device flow** runs in Core (it has the network and
   the integration code): Core polls GitHub and sends the token to main in
   a `store-secret` port message; main accepts only integration names and
   writes the vault. The renderer only sees the user code and the status.
   The OAuth app's client id is public and lives in the workspace setting
   `github:settings`, so device sign-in is off until it is set.
   `AGENTIC_GITHUB_API_URL` points Core at GitHub Enterprise or a stand-in.
3. **Agent tools on the shared `ToolRegistry`.** Reads (`github.repo.get`,
   `github.issue.get`, `github.issues.list`, `github.pr.get`,
   `github.file.read`, `github.code.search`) are `read`; `github.branch.create`,
   `github.push`, `github.pr.create`, `github.comment`, `github.review` are
   `write`, so the default policy asks a person first. Commits stay local
   (`git.commit`); `github.pr.create` pushes the working dir's branch when
   no `head` is given. The chat App gets read-only `github_issue`,
   `github_pull`, and `github_issues` `AppTool`s.
4. **Worktree per run.** A new working-dir policy, `worktree`, names an
   input with `owner/name` (cloned blobless into `<data>/git/repos`, fetched
   before each new worktree) or a local repo inside an allowed folder. Each
   run gets `<data>/git/worktrees/<run>/<repo>` on branch
   `agentic/run-<id>`; every node of the run shares it, and creation is
   idempotent so a resumed run finds it again. Runs now carry `run_id` in
   `configurable`. The worktrees root is a *managed dir*: tools may run
   there without an allowlist entry. Git sends the token through
   `GIT_CONFIG_*` environment variables (an `http.extraheader`), so it
   never lands in argv or a clone's `.git/config`.
5. **Triggers poll.** A `github` trigger watches a repo for
   `issue.opened`, `issue.labeled` (label required), or `review.requested`
   (search for `review-requested:@me`). The scheduler sweep claims due GitHub
   triggers with `SKIP LOCKED` like schedules and enqueues a
   `trigger.github.poll` job (default every 120 s). The poll's cursor and
   the keys of fired items live in the trigger's config; the job saves them
   **before** starting runs, so a crash never fires an item twice. The first
   poll is a baseline, so existing issues don't start a storm of runs. Each
   new item starts the published workflow with the saved inputs plus the
   item (Markdown text or JSON) in `itemField` and the repo in `repoField`.
6. **Built-ins as data.** Agents `issue-coder` (llm, fs/git tools, worktree),
   `git-committer` (tool `git.commit`), and `pr-opener` (tool
   `github.pr.create`, asks first), and the template `github-issue-to-pr`
   (implement → commit → open PR), which a GitHub trigger can feed.

## Consequences

- No webhooks: activity shows up within the poll interval, and each poll
  costs one or two API calls per trigger.
- `gh` users get GitHub without any setup; a saved token overrides it.
- Worktrees and clones accumulate under the data dir until cleanup lands
  (Backlog).
- A `worktree` agent that opens a PR needs an `owner/name` input; with a
  local path it can commit and push, but `github.pr.create` reads the repo
  from `origin`.
