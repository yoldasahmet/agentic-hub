import { EmptyState, ScrollArea, toast } from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { useCore } from "../../lib/core";
import { ImportFileButton } from "../../lib/import-file-button";
import { showError } from "../../lib/show-error";
import { NewWorkflowDialog } from "./new-workflow-dialog";
import { useImportWorkflow, useWorkflows } from "./queries";
import { TemplatesDialog } from "./templates-dialog";
import { WorkflowCard } from "./workflow-card";

/** Workflows: every workflow in the workspace, plus new, import, and templates. */
export function WorkflowsPage() {
  const core = useCore();
  const navigate = useNavigate();
  const workflows = useWorkflows();
  const importWorkflow = useImportWorkflow();
  const list = workflows.data ?? [];
  const actions = (
    <>
      <TemplatesDialog />
      <ImportFileButton
        busy={importWorkflow.isPending}
        onImport={(file) =>
          importWorkflow.mutate(file, {
            onSuccess: (w) => {
              toast.success(`Imported ${w.name}`);
              void navigate({ to: "/workflows/$workflowId", params: { workflowId: w.id } });
            },
            onError: (err) => showError(err),
          })
        }
      />
      <NewWorkflowDialog />
    </>
  );
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h1 className="flex-1 font-serif text-lg">Workflows</h1>
        {core && actions}
      </header>
      {!core ? (
        <EmptyState
          icon={Workflow}
          title="Core is starting"
          description="Workflows appear once the embedded server is ready."
        />
      ) : workflows.isSuccess && list.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflows yet"
          description="Wire agents into a graph with branches, loops, parallel steps, and human gates, or start from a template."
          action={
            <div className="flex gap-2">
              <TemplatesDialog />
              <NewWorkflowDialog />
            </div>
          }
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((workflow) => (
              <li key={workflow.id}>
                <WorkflowCard workflow={workflow} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
