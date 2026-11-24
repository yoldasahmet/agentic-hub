# Workflows

A workflow composes agents into a graph. It can branch, run steps in
parallel, loop, pause for people, and call other workflows. Like agents,
workflows autosave a draft and **publish** immutable versions.

## The canvas

- Drag agents, workflows, and **gates** from the palette onto the canvas,
  then connect them. Nodes take their agent's color and icon.
- Select a node to edit it in the inspector, or an edge to edit its
  condition. **Auto-layout**, undo/redo, and a minimap are in the toolbar.
- The **validation panel** lists problems (missing bindings, unreachable
  nodes, cycles without a loop cap, unpublished agents, …). Click one to
  jump to the node.

## Node kinds

| Kind | Notes |
| --- | --- |
| **Agent** | Runs a published agent version, or `latest` while you edit. |
| **Workflow** | Runs another workflow as a sub-workflow. Its gates pause the parent run. |
| **Gate** | Shows a title, a message (`{{input.x}}` reads the gate's data), and fields a reviewer can edit. **On reject:** `stop` fails the run; `continue` records `approved: false` so a condition can route around it. |

Every node can also:

- **review its input** (pause before it runs so a person can check and edit
  what goes in) or **review its output** (pause after it),
- **retry** on failure (up to 5 attempts with a backoff),
- be **disabled** without deleting it,
- choose how it **joins** several incoming edges: `all` waits for every
  running branch; `any` runs once per arrival.

## Bindings: where inputs come from

Each input field of a node is **bound** to one of:

- a **workflow input** field,
- an upstream **node's output** (one field, or the whole output),
- a **literal** value,
- a JSON-logic **expression** over the run state (advanced).

A binding can have a **fallback**, used when its source is missing (for
example a branch that didn't run). The **Inputs & outputs** tab defines the
workflow's own inputs and outputs; **Output mapping** picks where each
output comes from (empty: the merged outputs of the last nodes).

## Branches, parallel steps, and loops

- All outgoing edges whose **condition** holds are followed, **in
  parallel**. An edge with no condition is always followed.
- Conditions are picked from lists (`nodes.review.output.approved` equals
  `true`, …), or written as JSON-logic.
- An edge with **max iterations** is a loop edge: it is followed while its
  target has run at most that many times. That keeps loops from running
  forever.

## Running

The **Runs** tab starts the draft or a published version with a form for
the workflow's inputs. A draft run validates the draft first and pins every
`latest` reference, so the run is reproducible.

The **run view** shows the canvas with live node status and the edges that
were followed. Click a node for its input, output, events, and usage. Gates
and reviews appear inline: approve, edit, reject, or comment. Tick two runs
in the **Runs** tab and click **Compare** to see them side by side, node by
node, with output diffs.

## Triggers

The **Triggers** tab starts a published version with saved inputs:

| Trigger | Fires |
| --- | --- |
| **Manual** | When you click it (or from the CLI) |
| **On a schedule** | On a five-field cron (minute hour day month weekday) in a time zone you pick |
| **On GitHub activity** | When an issue is opened, an issue gets a label, or your review is requested, in one repository |
| **On Jira activity** | When an issue newly matches a JQL query |

GitHub and Jira triggers **poll** (every 2 minutes by default, at least 60
seconds), so they need no public webhook URL. The issue or pull request
goes into the input you name, as a Markdown summary or as JSON. A GitHub
trigger can also put `owner/name` into a second input (handy for a
worktree), and a Jira trigger the issue key. Each item starts one run; the
same item never fires twice. On a team DB, each due trigger fires once
across all running apps.

A trigger shows when it last fired, its last run, and its last error.

## Templates, import, and export

**Workflow templates** creates a workflow from a template. Workflows
export and import as JSON or YAML bundles, from the **⋯** menu and the
Workflows page. A bundle carries the agents it uses (by slug), the inline
skills they name, and their MCP servers: on import, ones that already exist
in the workspace are reused, and missing ones are installed from the bundle
or the agent library. MCP servers arrive **disabled**; check them in
**Settings → MCP servers** and turn them on. Folder skills don't travel.

### The SDLC pipeline

**SDLC pipeline** takes a task and a repo (`owner/name`, or a local repo in
an allowed folder) and works in one git worktree per run:

1. **Plan** reads the repo and writes a spec and ordered steps.
2. **Design** turns the spec into a design brief (and an HTML mockup when a
   screen changes).
3. **Code** implements the steps, commits, and opens a pull request.
4. **Review** looks for blockers only. Blockers send the work back to
   Code with the review (up to 3 times).
5. **Test** adds end-to-end tests in `e2e/`, runs them, and pushes them.
   Failures go back to Code with the output (up to 3 times).
6. **Deploy** merges the pull request and runs the project's deploy
   runbook (for example `DEPLOY.md`), if it has one.

Add it from **Workflows → Templates** (choose **Add again** if you already
have an older SDLC pipeline); its six **SDLC** agents then show on the
**Agents** page. You can also add any of them alone from **Agents →
Library**. Its agents ask before they write, push, merge, or run commands. It needs
GitHub connected ([Integrations](integrations.md)). Installing it adds the
skills its agents follow (spec writing, design system, code style, code
review, test runner, E2E testing, deploy runbook; your own skill with the
same slug wins) and a disabled `figma` MCP server for Figma's desktop Dev
Mode server: turn it on and add it to **SDLC Designer** to design from
Figma frames.

### Marketing Campaign Draft

Add **Marketing Campaign Draft** from **Workflow templates**. It installs
the Marketing Strategist, Marketing Copywriter, and Marketing Editor.
Click **Run** and enter a brief with your campaign goal, brand voice, and
approved facts, then provide the audience and channel. The result includes
a campaign plan, edited copy, and any details to verify before publishing.
Both this workflow and the SDLC pipeline use **Codex · GPT-6 Luna** on a fresh install.
If the workspace already has one of their agents, installation reuses it.
To change its model, open the agent’s **Runtime** tab and publish the change.
Publish the workflow again to pin the new agent version.

### Try the examples

For **Marketing Campaign Draft**, use a fictional journal launch. The brief is
“Introduce Field Notes, a printable birdwatching journal. Each page has space
for the date, location, species and a sketch. Invite readers to print a sample
page. Use a calm voice and keep the email under 90 words.” Set the audience
to “New birdwatchers who enjoy a neighborhood walk” and the channel to
“Welcome email.” The last node returns the edited copy and review notes.

For **SDLC pipeline**, use your own disposable GitHub repository with a
`format.mjs` file exporting `heading(title)`, which returns `'# ' + title`.
Add a `node:test` case for an already-trimmed title. Set **repo** to
your repository’s `owner/name` and **task** to “Trim leading and trailing
whitespace before adding the Markdown prefix. Preserve internal spaces
and add a regression test.” Use `node --test` as the test command.
Approve the tools at each gate to let the pipeline commit, open the PR,
test and merge it. A repository without a deploy runbook ends at the merge.

In the verified marketing run, the editor returned “A page for your next walk” and flagged the sample-page link for confirmation. The SDLC example used a local Git repository and a loopback stand-in for GitHub’s pull request API. The merged branch passed all three tests, including cases for tabs, line breaks and repeated internal spaces.

Next: [Chat](chat.md).
