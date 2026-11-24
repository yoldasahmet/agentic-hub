import {
  identityColorSchema,
  identityIconSchema,
  type Workflow,
  type WorkflowVersion,
  workflowDocumentSchema,
} from "@agentic/contracts";
import type { WorkflowRow, WorkflowVersionRow } from "./repository";

/** Rows to DTOs. jsonb and text columns are parsed, never cast. */
export function toWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    color: identityColorSchema.catch("slate").parse(row.color),
    icon: identityIconSchema.catch("workflow").parse(row.icon),
    draft: workflowDocumentSchema.parse(row.draft),
    revision: row.revision,
    latestVersion: row.latestVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWorkflowVersion(row: WorkflowVersionRow): WorkflowVersion {
  return {
    id: row.id,
    workflowId: row.workflowId,
    version: row.version,
    document: workflowDocumentSchema.parse(row.document),
    createdAt: row.createdAt.toISOString(),
  };
}
