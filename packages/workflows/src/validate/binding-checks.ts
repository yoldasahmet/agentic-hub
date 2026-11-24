import type {
  BaseBinding,
  Binding,
  ValidationIssue,
  WorkflowDocument,
  WorkflowNode,
} from "@agentic/contracts";
import type { ValidationCatalog } from "../catalog";
import { fieldTypes, nodeIo, requiredFields } from "../node-io";
import { ancestors } from "../topology";
import { error, warning } from "./issue";

type Context = {
  doc: WorkflowDocument;
  catalog: ValidationCatalog;
  nodes: Map<string, WorkflowNode>;
  inputs: Map<string, string | undefined>;
};

/** Every node's bindings, and the workflow's output mapping. */
export function bindingChecks(
  doc: WorkflowDocument,
  catalog: ValidationCatalog,
): ValidationIssue[] {
  const ctx: Context = {
    doc,
    catalog,
    nodes: new Map(doc.nodes.map((n) => [n.id, n])),
    inputs: fieldTypes(doc.inputSchema),
  };
  const issues: ValidationIssue[] = [];
  for (const node of doc.nodes) {
    if (!node.enabled) continue;
    const io = nodeIo(node, catalog);
    if (!io) continue;
    const targets = fieldTypes(io.inputSchema);
    const upstream = ancestors(doc, node.id);
    for (const [field, binding] of Object.entries(node.bindings)) {
      const where = { node: node.id, field };
      if (!targets.has(field)) {
        issues.push(error("unknown_input_field", `"${node.id}" has no input "${field}"`, where));
        continue;
      }
      issues.push(...sourceChecks(ctx, binding, targets.get(field), upstream, where));
    }
    for (const field of requiredFields(io.inputSchema)) {
      if (node.bindings[field]) continue;
      issues.push(
        error("unbound_required_field", `Connect the required input "${field}" of "${node.id}"`, {
          node: node.id,
          field,
        }),
      );
    }
  }
  return [...issues, ...outputChecks(ctx)];
}

function outputChecks(ctx: Context): ValidationIssue[] {
  const targets = fieldTypes(ctx.doc.outputSchema);
  const everyNode = new Set(ctx.doc.nodes.map((n) => n.id));
  return Object.entries(ctx.doc.outputs).flatMap(([field, binding]) => {
    if (!targets.has(field)) {
      return [error("unknown_output_binding", `The workflow has no output "${field}"`, { field })];
    }
    return sourceChecks(ctx, binding, targets.get(field), everyNode, { field });
  });
}

function sourceChecks(
  ctx: Context,
  binding: Binding,
  targetType: string | undefined,
  upstream: Set<string>,
  where: { node?: string; field: string },
): ValidationIssue[] {
  const primary = sourceIssues(ctx, binding, targetType, upstream, where, !!binding.fallback);
  const fallback = binding.fallback
    ? sourceIssues(ctx, binding.fallback, targetType, upstream, where, false)
    : [];
  return [...primary, ...fallback];
}

function sourceIssues(
  ctx: Context,
  binding: BaseBinding,
  targetType: string | undefined,
  upstream: Set<string>,
  where: { node?: string; field: string },
  hasFallback: boolean,
): ValidationIssue[] {
  if (binding.kind === "input") {
    if (ctx.inputs.has(binding.field)) {
      return typeIssues(ctx.inputs.get(binding.field), targetType, `input.${binding.field}`, where);
    }
    return [error("unknown_input_field", `The workflow has no input "${binding.field}"`, where)];
  }
  if (binding.kind !== "node") return [];
  const source = ctx.nodes.get(binding.node);
  const path = `${binding.node}.${binding.field ?? "output"}`;
  if (!source) {
    return [error("unknown_node_reference", `${path} reads a node that doesn't exist`, where)];
  }
  const issues: ValidationIssue[] = [];
  if (!source.enabled && !hasFallback) {
    issues.push(error("dangling_binding", `${path} reads a disabled node; add a fallback`, where));
  }
  if (!upstream.has(source.id)) {
    issues.push(warning("binding_not_upstream", `${path} doesn't run before this node`, where));
  }
  const io = nodeIo(source, ctx.catalog);
  if (io && binding.field !== null) {
    const outputs = fieldTypes(io.outputSchema);
    if (!outputs.has(binding.field)) {
      issues.push(
        error("unknown_output_field", `"${binding.node}" has no output "${binding.field}"`, where),
      );
    } else {
      issues.push(...typeIssues(outputs.get(binding.field), targetType, path, where));
    }
  }
  return issues;
}

/** Only clear mismatches warn: numbers into integers and anything into text pass. */
function typeIssues(
  from: string | undefined,
  to: string | undefined,
  path: string,
  where: { node?: string; field: string },
): ValidationIssue[] {
  if (!from || !to || from === to || to === "string") return [];
  if (from === "integer" && to === "number") return [];
  return [
    warning("binding_type_mismatch", `${path} is ${from}, but ${where.field} expects ${to}`, where),
  ];
}
