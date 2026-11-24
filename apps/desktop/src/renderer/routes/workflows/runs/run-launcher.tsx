import {
  AppError,
  type Workflow,
  type WorkflowDocument,
  type WorkflowVersionRef,
} from "@agentic/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type FormValue,
  Label,
  SchemaForm,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  schemaDefaults,
} from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { showError } from "../../../lib/show-error";
import { useRunWorkflow, useWorkflowVersions } from "../queries";

type Props = { workflow: Workflow; doc: WorkflowDocument; draftReady: boolean };

const issuesSchema = z.object({ issues: z.array(z.string()) });

/** Pick the draft or a version, fill its inputs (SchemaForm), and watch the run. */
export function RunLauncher({ workflow, doc, draftReady }: Props) {
  const navigate = useNavigate();
  const versions = useWorkflowVersions(workflow.id).data ?? [];
  const run = useRunWorkflow();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState<WorkflowVersionRef>("draft");
  const schema =
    version === "draft"
      ? doc.inputSchema
      : versions.find((v) => v.version === version)?.document.inputSchema;
  const [input, setInput] = useState<FormValue>(() => schemaDefaults(doc.inputSchema));
  const [issues, setIssues] = useState<string[]>([]);
  const blocked = version === "draft" && !draftReady;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Play aria-hidden /> Run
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run.mutate(
              { id: workflow.id, input: { version, input } },
              {
                onSuccess: (started) => {
                  setOpen(false);
                  setIssues([]);
                  void navigate({
                    to: "/workflows/$workflowId/runs/$runId",
                    params: { workflowId: workflow.id, runId: started.id },
                  });
                },
                onError: (err) => {
                  const parsed =
                    err instanceof AppError ? issuesSchema.safeParse(err.details) : undefined;
                  if (parsed?.success) setIssues(parsed.data.issues);
                  showError(err);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Run {workflow.name}</DialogTitle>
            <DialogDescription>
              Draft runs pin the draft as it is now; edits don't change them.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>Version</Label>
            <Select
              value={String(version)}
              onValueChange={(v) => setVersion(v === "draft" ? "draft" : Number(v))}
            >
              <SelectTrigger aria-label="Version">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                {versions.map((v) => (
                  <SelectItem
                    key={v.version}
                    value={String(v.version)}
                  >{`v${v.version}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SchemaForm
            schema={schema ?? {}}
            value={input}
            onChange={setInput}
            issues={issues}
            emptyHint="This workflow takes no inputs."
          />
          {blocked && (
            <p className="text-sm text-warning-ink">
              Fix the draft's errors (or wait for it to save) first.
            </p>
          )}
          <DialogFooter>
            <Button type="submit" variant="primary" disabled={blocked || run.isPending}>
              <Play aria-hidden /> Start run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
