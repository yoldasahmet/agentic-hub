import { hasBlockingIssues, type Workflow } from "@agentic/contracts";
import { Badge, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@agentic/ui";
import { Upload } from "lucide-react";
import { useEffect } from "react";
import { IdentityPicker } from "../../../components/identity-picker";
import { SaveIndicator } from "../../../components/save-indicator";
import { showError } from "../../../lib/show-error";
import { usePublishWorkflow } from "../queries";
import { RunLauncher } from "../runs/run-launcher";
import { RunsTab } from "../runs/runs-tab";
import { TriggersTab } from "../triggers/triggers-tab";
import { CanvasTab } from "./canvas-tab";
import { IoTab } from "./io-tab";
import { useTargets } from "./use-targets";
import { useWorkflowDraft } from "./use-workflow-draft";
import { WorkflowMenu } from "./workflow-menu";

/** One workflow: identity, the canvas, I/O and output mapping, runs, and triggers. ⌘Z / ⇧⌘Z undo. */
export function WorkflowEditor({ workflow }: { workflow: Workflow }) {
  const draft = useWorkflowDraft(workflow);
  const { lookup, palette } = useTargets(draft.doc, workflow.id);
  const publish = usePublishWorkflow();
  const blocked = hasBlockingIssues(draft.issues);
  useUndoKeys(draft.undo, draft.redo);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <IdentityPicker
          color={draft.identity.color}
          icon={draft.identity.icon}
          onChange={draft.editIdentity}
        />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <Input
            aria-label="Workflow name"
            className="h-8 border-transparent bg-transparent px-1 font-serif text-lg hover:border-border-input"
            value={draft.identity.name}
            onChange={(event) => draft.editIdentity({ name: event.target.value })}
          />
          <Input
            aria-label="Description"
            placeholder="What this workflow does"
            className="h-7 border-transparent bg-transparent px-1 text-fg-muted hover:border-border-input"
            value={draft.identity.description}
            onChange={(event) => draft.editIdentity({ description: event.target.value })}
          />
        </div>
        <SaveIndicator state={draft.state} problem="Give the workflow a name" />
        <Badge>
          {workflow.latestVersion ? `v${workflow.latestVersion} published` : "Not published"}
        </Badge>
        <RunLauncher
          workflow={workflow}
          doc={draft.doc}
          draftReady={draft.state === "saved" && !blocked}
        />
        <Button
          disabled={draft.state !== "saved" || blocked || publish.isPending}
          title={blocked ? "Fix the errors first" : undefined}
          onClick={() =>
            publish.mutate(
              { id: workflow.id, revision: draft.revision() },
              {
                onSuccess: (v) => toast.success(`Published v${v.version}`),
                onError: (err) => showError(err),
              },
            )
          }
        >
          <Upload aria-hidden /> Publish
        </Button>
        <WorkflowMenu workflow={workflow} />
      </header>
      <Tabs defaultValue="canvas" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="px-4">
          <TabsTrigger value="canvas">Canvas</TabsTrigger>
          <TabsTrigger value="io">Inputs &amp; outputs</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
        </TabsList>
        <TabsContent value="canvas" className="flex min-h-0 flex-1 data-[state=inactive]:hidden">
          <CanvasTab
            doc={draft.doc}
            issues={draft.issues}
            lookup={lookup}
            palette={palette}
            onChange={draft.editDoc}
            history={draft}
          />
        </TabsContent>
        <TabsContent value="io" className="min-h-0 flex-1 overflow-auto">
          <IoTab doc={draft.doc} lookup={lookup} onChange={draft.editDoc} />
        </TabsContent>
        <TabsContent value="runs" className="min-h-0 flex-1 overflow-auto">
          <RunsTab workflow={workflow} />
        </TabsContent>
        <TabsContent value="triggers" className="min-h-0 flex-1 overflow-auto">
          <TriggersTab workflow={workflow} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** ⌘Z and ⇧⌘Z, except while typing in a field (the field keeps its own undo). */
function useUndoKeys(undo: () => void, redo: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]"))
        return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
}
