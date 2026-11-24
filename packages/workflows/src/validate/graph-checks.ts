import type { ValidationIssue, WorkflowDocument } from "@agentic/contracts";
import type { ValidationCatalog } from "../catalog";
import { lookupTarget } from "../node-io";
import { topology, unboundedCycleEdges } from "../topology";
import { error, warning } from "./issue";

/** Structure: ids, edges, targets, cycles, entry and exit, orphans. */
export function graphChecks(
  doc: WorkflowDocument,
  catalog: ValidationCatalog,
  workflowId: string | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (doc.nodes.length === 0) {
    return [error("empty_workflow", "Add a node to the canvas")];
  }
  const seen = new Set<string>();
  for (const node of doc.nodes) {
    if (seen.has(node.id)) {
      issues.push(
        error("duplicate_node_id", `Two nodes use the id "${node.id}"`, { node: node.id }),
      );
    }
    seen.add(node.id);
    issues.push(...targetChecks(node, catalog, workflowId));
  }
  for (const edge of doc.edges) {
    if (!seen.has(edge.from) || !seen.has(edge.to)) {
      issues.push(
        error("unknown_edge_node", "This edge connects a node that no longer exists", {
          edge: edge.id,
        }),
      );
    }
  }
  const topo = topology(doc);
  for (const edge of unboundedCycleEdges(topo.edges)) {
    issues.push(
      error("unbounded_cycle", `The loop ${edge.from} → ${edge.to} needs a max iterations limit`, {
        edge: edge.id.split(">")[0],
      }),
    );
  }
  if (topo.nodes.length > 0 && (topo.entries.length === 0 || topo.exits.length === 0)) {
    issues.push(
      error("no_entry_or_exit", "The workflow needs a node to start from and one to end on"),
    );
  }
  if (topo.nodes.length > 1) {
    for (const node of topo.nodes) {
      if (topo.incoming(node.id).length === 0 && topo.outgoing(node.id).length === 0) {
        issues.push(warning("orphaned_node", `"${node.id}" isn't connected`, { node: node.id }));
      }
    }
  }
  return issues;
}

function targetChecks(
  node: WorkflowDocument["nodes"][number],
  catalog: ValidationCatalog,
  workflowId: string | undefined,
): ValidationIssue[] {
  const found = lookupTarget(node, catalog);
  if (!found || node.kind === "gate") return [];
  const where = { node: node.id };
  const what = node.kind === "agent" ? "agent" : "workflow";
  if (found.status === "missing") {
    const code = node.kind === "agent" ? "unknown_agent" : "unknown_workflow";
    return [error(code, `"${node.id}" uses a ${what} that no longer exists`, where)];
  }
  if (found.status === "unknown_version") {
    return [
      error("unknown_version", `"${node.id}" pins v${node.version}, which doesn't exist`, where),
    ];
  }
  const issues: ValidationIssue[] = [];
  if (!found.entry.published) {
    const code = node.kind === "agent" ? "agent_unpublished" : "workflow_unpublished";
    const message = `Publish the ${what} "${found.entry.name}" to run it in a workflow`;
    issues.push(error(code, message, where));
  }
  if (node.kind === "workflow" && workflowId && found.entry.reaches?.includes(workflowId)) {
    issues.push(
      error("subworkflow_cycle", `"${node.id}" would run this workflow inside itself`, where),
    );
  }
  return issues;
}
