import { EmptyState } from "@agentic/ui";
import { useParams } from "@tanstack/react-router";
import { Workflow } from "lucide-react";
import { useWorkflow } from "../queries";
import { WorkflowEditor } from "./workflow-editor";

/** `/workflows/$workflowId`. Keyed by workflow so switching resets the local draft and history. */
export function WorkflowEditorPage() {
  const { workflowId } = useParams({ from: "/workflows/$workflowId" });
  const workflow = useWorkflow(workflowId);
  if (workflow.error) {
    return (
      <EmptyState icon={Workflow} title="Workflow not found" description={workflow.error.message} />
    );
  }
  if (!workflow.data) return null;
  return <WorkflowEditor key={workflow.data.id} workflow={workflow.data} />;
}
