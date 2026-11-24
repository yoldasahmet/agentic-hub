# Design system: Claude light

A calm, warm, readable interface based on Claude's light look. The canvas is
a **slightly darker** warm neutral, so white cards and panels stand out.
Color carries **identity**: each agent and workflow has its own hue, used
the same way everywhere.

Tokens live in `packages/ui/src/tokens/` as CSS variables mapped into
Tailwind (`tokens/theme.css`). The default Tailwind palette is cleared, so
only token utilities exist: `bg-canvas`, `bg-surface`, `text-fg`,
`text-fg-muted`, `border-border-input`, `bg-success-tint`, `rounded-card`,
`shadow-1`, `text-code`, … Components never use raw hex values. All contrast ratios below
were measured against WCAG 2.1.

## Neutrals

| Token | Hex | Use |
| --- | --- | --- |
| `--canvas` | `#EFEDE4` | App background (a bit darker than Claude's ivory) |
| `--sidebar` | `#E7E4D9` | Sidebar, title bar |
| `--surface` | `#FAF9F5` | Cards, panels, chat column, inputs |
| `--surface-raised` | `#FFFFFF` | Popovers, menus, dialogs |
| `--surface-sunken` | `#E9E6DB` | Code blocks, wells, table headers |
| `--border` | `#DAD6C9` | Dividers, card outlines (decorative) |
| `--border-input` | `#928C7C` | Input and control outlines (3.2:1 on surface) |
| `--text` | `#1F1E1B` | Body text (14.2:1 on canvas) |
| `--text-muted` | `#5E5A50` | Secondary text (5.9:1 on canvas) |
| `--text-subtle` | `#858071` | Placeholders and meta only, never body (3.7:1) |

## Accent and status

| Token | Hex | Use |
| --- | --- | --- |
| `--accent` | `#C96442` | Claude terracotta: focus ring, highlights, icons (3.3:1 on canvas) |
| `--primary` / `-hover` | `#B4553A` / `#9E4A32` | Primary button fill. White text is 4.9:1. |
| `--accent-tint` / `--accent-ink` | `#F6E4DB` / `#8A3B22` | Selected rows, active nav (6.2:1) |
| `--success` (solid / tint / ink) | `#3F8A57` / `#DDEEDF` / `#24573A` | Succeeded |
| `--warning` | `#A8741A` / `#F6EBCF` / `#6E4A0E` | Paused, waiting for input |
| `--danger` | `#B3402F` / `#F6DEDA` / `#8E2F22` | Failed, destructive actions |
| `--info` | `#3D78B8` / `#DCE7F4` / `#234C7A` | Running, informational |

Status is always shown with **icon + label**, never color alone.

## Identity palette (agents and workflows)

Ten hues tuned to sit on the warm neutrals. Each has three tokens:

- `solid` for dots, node stripes, and avatar fills (≥3:1 on canvas),
- `tint` for chip and card-header backgrounds,
- `ink` for text on the tint (≥6:1).

| Name | Solid | Tint | Ink | Ink on tint |
| --- | --- | --- | --- | --- |
| terracotta | `#C96442` | `#F6E4DB` | `#8A3B22` | 6.2:1 |
| amber | `#A8741A` | `#F6EBCF` | `#6E4A0E` | 6.7:1 |
| olive | `#76842B` | `#ECEFD4` | `#4A5319` | 7.0:1 |
| green | `#3F8A57` | `#DDEEDF` | `#24573A` | 7.0:1 |
| teal | `#2E8A86` | `#D7EEEC` | `#1B5754` | 6.8:1 |
| blue | `#3D78B8` | `#DCE7F4` | `#234C7A` | 7.0:1 |
| indigo | `#5B63B7` | `#E2E3F5` | `#383E86` | 7.5:1 |
| violet | `#8657B0` | `#ECE1F4` | `#5A3680` | 7.3:1 |
| plum | `#A84E86` | `#F3DFEA` | `#73305A` | 7.2:1 |
| slate | `#66707A` | `#E4E7EA` | `#3E454C` | 7.8:1 |

**Rules**

- In code, set `data-hue="<name>"` on an element and use the
  `bg-hue-solid`, `bg-hue-tint`, and `text-hue-ink` utilities. Class names
  stay static, so Tailwind sees them.
- A new agent or workflow gets a color from a hash of its id. Users can
  change the color and pick a Lucide icon.
- An entity's color + icon + name appear together everywhere: sidebar dot,
  `EntityChip`, canvas node (4px solid stripe + tint header), run timeline
  lane, and the chat target chip and avatar.
- Text never sits on `solid`. Text on `tint` always uses `ink`. White icons
  on `solid` are fine (all ≥3.4:1).
- Workflow canvas nodes take the color of the **agent** they run, and the
  workflow's own color frames the canvas header. You can see at a glance
  which agents a workflow uses.

## Typography

| Role | Font | Size / line-height |
| --- | --- | --- |
| UI | Inter | 13 / 20 (labels 500 weight) |
| Headings, assistant prose | Source Serif 4 (Claude-like serif) | 15 / 24 prose; 20–28 headings |
| Code, IDs, JSON | JetBrains Mono | 12.5 / 18 |

Fonts are self-hosted via `@fontsource`. The app never fetches fonts from
the network.

## Shape, depth, motion

- Spacing on a 4px grid.
- Radius: 6 (controls), 10 (cards), 14 (dialogs).
- `--shadow-1`: `0 1px 2px rgb(31 30 27 / .06), 0 1px 1px rgb(31 30 27 / .04)` for cards.
- `--shadow-2`: `0 8px 24px rgb(31 30 27 / .12)` for popovers and dialogs.
- Motion: 120–180 ms ease-out. Honor `prefers-reduced-motion`.
- All colors are tokens, so a dark theme can come later (Backlog).

## Layout

```
┌ traffic lights · title / breadcrumb ··················· ⌘K search ┐
│ Sidebar  │ Main view                          │ Context panel     │
│ Chats    │ (list · editor · conversation)     │ (resizable,       │
│ Agents   │                                    │  collapsible)     │
│ Workflows│                                    │                   │
│ Runs     │                                    │                   │
│ Inbox (3)│                                    │                   │
│ GitHub   │                                    │                   │
│ Jira     │                                    │                   │
│ Settings │                                    │                   │
└ status bar: DB local ● · Core ● · 2 running · 3 need input ───────┘
```

## UX principles

1. **Schema forms, never raw JSON.** Inputs, gate edits, playground runs,
   and chat intake all use `SchemaForm`. JSON is an "Advanced" toggle.
2. **One place for "needs you".** The Inbox collects pending human gates
   and failed runs. It is mirrored by a dock badge and a macOS notification.
3. **Keyboard first.**
   - `⌘K` command palette (go to, create, run)
   - `⌘N` new chat
   - `⌘↵` send / run
   - `⌘,` settings
   - `Esc` closes panels
4. **Drafts autosave, publishing is explicit.** Undo/redo in editors.
   Versions stay visible.
5. **Live but calm.** Streamed text. Compact tool-call rows that expand.
   Node status on the canvas. No layout shift while streaming.
6. **Empty states teach.** One sentence plus a template or a primary
   action.
7. **Errors are actionable.** Say what happened, why, and offer a fix or
   retry button. Details link to the logs.
8. **Consistent identity.** An agent looks the same on every screen.

## Component catalog: reuse before creating

Check this list before adding a component. Add new shared components here.

| Component | Used in | Source |
| --- | --- | --- |
| Button, Input, Textarea, Label, Select, Dialog, Popover, DropdownMenu, Tabs, Tooltip, Toaster (`toast`), Switch, Badge, Separator, ScrollArea | everywhere | `packages/ui/src/primitives/` (shadcn-style on `radix-ui`, sonner) |
| `ResizableGroup`, `ResizablePanel`, `ResizableHandle` | chats (list · conversation · context panel, terminal split) | `packages/ui/src/primitives/resizable.tsx` (react-resizable-panels) |
| `ChatMessageView`, `MessageList` (virtualized), `TurnProgress` (+ `turnView`), `InputsCard`, `AttachmentChip`, `targetIdentity`/`APP_IDENTITY` | chat | `packages/ui/src/features/chat/` (answers render by the target's output format; the list stays pinned to the bottom while streaming) |
| `Composer` (+ `ComposerSuggestion`) | chat, new chat | `packages/ui/src/features/chat/composer/` (`/` commands, `@` mentions, attachments, file drop, ⌘↵) |
| `CommandPalette` | global `⌘K` | `packages/ui/src/patterns/command-palette.tsx` (cmdk) |
| `EntityAvatar`, `EntityChip` (+ `entityIcons` map) | sidebar, lists, chat, canvas, runs | `packages/ui/src/patterns/` |
| `StatusPill`, `EmptyState`, `KeyHint` | everywhere | `packages/ui/src/patterns/` |
| `SchemaForm` (+ `schemaDefaults`) | playground, run launcher, chat intake, gates, settings | `packages/ui/src/patterns/schema-form/` (any object schema; "Edit as JSON" is the advanced path) |
| `SchemaEditor` (+ `fieldIssues`) | agent and workflow I/O | `packages/ui/src/patterns/schema-editor/` (fields ↔ JSON Schema via contracts `fieldsToSchema`/`schemaToFields`) |
| `TemplateInput`, `TemplatePreview` | agent prompt, later workflow and chat templates | `packages/ui/src/patterns/prompt-editor/` (`{{input.x}}` completion; preview uses the runtime's `renderTemplate`) |
| `TagListInput` | list fields, capability slots, guardrail folders, terminal attachments | `packages/ui/src/patterns/tag-list-input.tsx` (optional `suggestions` as a native datalist) |
| `PermissionBadge` | Settings → Tools / MCP servers, agent approvals, tool approval card | `packages/ui/src/patterns/permission-badge.tsx` (read neutral, write warning, dangerous danger) |
| `ModelPicker` | agent config, chat, Settings → Providers | `packages/ui/src/patterns/model-picker.tsx` (one enabled model) |
| `ModelChainPicker` | agent runtime | `packages/ui/src/patterns/model-chain-picker.tsx` (model, reasoning effort, fallbacks) |
| `UsageSummary` (+ `formatCost`) | Settings → Providers, playground, chat context panel | `packages/ui/src/patterns/usage-summary.tsx` |
| `EventStream` (+ `foldEvents`) | chat, playground, run view | `packages/ui/src/patterns/event-stream/` (status, model attempts, streamed text, thinking, tool calls, errors) |
| `OutputView` (`outputRenderers` registry: markdown, json, plan, diff, html, table) + `MarkdownText`, `DiffBlock` | playground, chat, runs | `packages/ui/src/patterns/output-view/` (HTML renders in an empty-sandbox iframe) |
| `WorkflowCanvas` (+ `autoLayout`, `takenEdges`, `PALETTE_MIME`) | workflow editor (editable) and run view (read-only, live statuses, followed edges) | `packages/ui/src/features/workflow/canvas/` (React Flow; nodes colored by their agent; minimap; dagre auto-layout) |
| `NodePalette`, `NodeInspector`, `EdgeInspector`, `OutputMapping`, `ValidationPanel` (+ doc ops: `addNode`, `connect`, `renameNode`, `removeNodes`, …) | workflow editor | `packages/ui/src/features/workflow/` (bindings and conditions are picked from lists; JSON-logic expressions are the advanced path) |
| `GateCard` | Inbox, workflow run view, Runs page, later chat | `packages/ui/src/patterns/gate-card/` (workflow gates and reviews: approve, edit with `SchemaForm`, reject, comment; `human` agents: answer; tool approvals (`ToolApproval`: tools, working dir, input, approve/reject with a note); unknown requests show `fallback`) |
| `StateInspector` (timeline, JSON view/edit, diff, fork) + `CheckpointTimeline`, `JsonView`, `JsonEditor`, `StateDiff` (`diffJson`) | runs, chats | `packages/ui/src/patterns/state-inspector/` (ported from reference `checkpoint-inspector`) |
| `DiffViewer` (+ `parsePatch`, `splitUnifiedDiff`) | GitHub pull request files (line comments), chat context panel (working dir diff) | `packages/ui/src/patterns/diff-viewer/` (ported from reference `pull-diff*`; file jump list, collapsible files, old/new line numbers, optional comment buttons) |
| `SetupStep` | first-run setup (`/welcome`) | `apps/desktop/src/renderer/routes/welcome/setup-step.tsx` (numbered card with a state badge: done, not set up, checking, needs attention; optional steps say so) |
| `showError(err, fallback?)` | every failed action in the renderer | `apps/desktop/src/renderer/lib/show-error.ts` (error toast with a hint for known codes and "View logs" filtered to the trace id; use it instead of `toast.error(err.message)`) |
| `RouteError`, `AppErrorBoundary` | router `defaultErrorComponent`, around the app | `apps/desktop/src/renderer/components/` (log the error; retry, view logs, copy diagnostics / reload) |
