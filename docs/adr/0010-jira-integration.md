# ADR 0010: Jira integration

- **Status:** accepted (Phase 11, 2026-10-11)
- **Relates to:** D8 (secrets), D11 (job queue), R2, ADR 0008, ADR 0009, P11.1–P11.5
- **Amends:** ADR 0008 (`ToolContext` gains `workspaceId`)

## Context

Phase 11 connects Jira Cloud as UI, agent tools, and a trigger source, and
links the pull requests agents open back to their issues. Like GitHub it
must keep the token out of Postgres, logs, and the renderer, stay correct
on a shared team DB, and work without a public webhook URL.

## Decision

1. **Auth: site + email per workspace, API token per app.** The Jira site
   (`https://<team>.atlassian.net`, plain `http` only on loopback for a
   stand-in) and the account email are the workspace setting
   `jira:settings`; the API token is the vault entry `jira.token`
   (`jira.*` joins the integration secrets main hands to Core). Requests use
   basic auth (email:token). `POST /jira/test` checks a site and email with
   a token typed just now, or the saved one, before anything is saved;
   `/jira/status` shows the signed-in account (`/myself`). OAuth (3LO) is
   left out: it needs a registered app and a redirect the desktop can't
   receive without extra plumbing.
2. **`packages/integrations/jira` (layer 3)** is a small REST v3 client on
   `fetch`: every response is parsed with Zod, 429/503 wait for
   `Retry-After` (up to a minute, twice), and errors map to app codes
   (`jira.unauthorized`, `forbidden`, `not_found`, `validation_failed` for
   bad JQL, `jira.rate_limited`, `jira.failed`). Search uses the enhanced
   `POST /search/jql` endpoint (token paging), since offset search is
   deprecated. Octokit-style SDKs for Jira add weight without a benefit here.
3. **ADF ↔ Markdown.** Descriptions and comments are converted to Markdown
   when read (paragraphs, headings, marks, lists, task lists, code, quotes,
   panels, tables, mentions, cards; unknown nodes degrade to their text) and
   from Markdown when written (headings, fenced code, nested lists, quotes,
   rules, bold/italic/strike/code/links). The UI and agents only see
   Markdown.
4. **Tools carry the workspace.** `ToolContext` gains `workspaceId`, so a
   Jira tool uses the run's workspace settings. Reads (`jira.issue.get`,
   `jira.search`, `jira.projects.list`) are `read`; `jira.comment`,
   `jira.transition` (by transition name, target status, or id),
   `jira.issue.create`, `jira.subtask.create` (the project's sub-task type
   unless named), and `jira.link` are `write`. The chat App gets
   `jira_issue` and `jira_search`.
5. **Triggers poll JQL.** A `jira` trigger runs its JQL (the user's
   `ORDER BY` replaced with `updated DESC`, 50 per poll) through the same
   `SKIP LOCKED` sweep, as a `trigger.jira.poll` job. The keys that fired
   live in the trigger's config and are saved before runs start; the first
   poll is a baseline. An issue fires once, the first time it matches; a
   changed JQL starts a new baseline. The issue (Markdown or JSON) goes into
   `itemField` and its key into `keyField`.
6. **PR ↔ issue links.** After a PR is opened (`github.pr.create` or the
   GitHub page), Core links it as a remote link on every issue key its
   branch (any case, leading key), title, or body names (case-sensitive),
   with the PR URL as `globalId` so relinking updates instead of
   duplicating. It's best effort: no Jira connection or an unknown key never
   fails the PR. The template `jira-issue-to-pr` also links explicitly with
   the `jira-pr-linker` built-in (asks first), so the exit path doesn't rely
   on key detection. The GitHub PR view shows the keys it names.

## Consequences

- No webhooks: matches show up within the poll interval (default 120 s).
- An issue that leaves and re-enters the JQL doesn't fire again while its
  key is in the last 1,000 seen.
- One Jira account per app token; workspaces may point it at different
  sites, but share the token.
- Key detection in free text can match strings like `SHA-256`; those links
  fail as unknown issues and are skipped.
