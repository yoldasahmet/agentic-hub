import { z } from "zod";

/**
 * Stable issue codes (ported from the reference validator, plus the ones
 * subworkflows, gates, and pinned versions need). The UI keys help text
 * and highlights off the code, so codes are never renamed.
 */
export const validationCodes = [
  "duplicate_node_id",
  "unknown_agent",
  "unknown_workflow",
  "agent_unpublished",
  "workflow_unpublished",
  "unknown_version",
  "subworkflow_cycle",
  "unknown_node_reference",
  "binding_not_upstream",
  "unknown_input_field",
  "unknown_output_field",
  "binding_type_mismatch",
  "dangling_binding",
  "unbound_required_field",
  "unknown_edge_node",
  "unbounded_cycle",
  "no_entry_or_exit",
  "orphaned_node",
  "empty_workflow",
  "unknown_output_binding",
] as const;
export const validationCodeSchema = z.enum(validationCodes);
export type ValidationCode = z.infer<typeof validationCodeSchema>;

export const validationIssueSchema = z.object({
  code: validationCodeSchema,
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  node: z.string().optional(),
  edge: z.string().optional(),
  field: z.string().optional(),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const hasBlockingIssues = (issues: ValidationIssue[]) =>
  issues.some((issue) => issue.severity === "error");
