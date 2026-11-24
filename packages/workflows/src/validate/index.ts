import type { ValidationIssue, WorkflowDocument } from "@agentic/contracts";
import type { ValidationCatalog } from "../catalog";
import { bindingChecks } from "./binding-checks";
import { graphChecks } from "./graph-checks";

/**
 * Static checks with stable codes. Saves report them (the editor's live
 * panel); publishing and runs refuse errors. `workflowId` lets subworkflow
 * references detect a cycle back to this workflow.
 */
export function validateWorkflow(
  doc: WorkflowDocument,
  catalog: ValidationCatalog,
  workflowId?: string,
): ValidationIssue[] {
  return [...graphChecks(doc, catalog, workflowId), ...bindingChecks(doc, catalog)];
}
