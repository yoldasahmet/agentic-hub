import {
  type EntityIdentity,
  hasFields,
  type IoField,
  schemaToFields,
  type WorkflowDocument,
  type WorkflowNode,
} from "@agentic/contracts";
import { gateEntity, type TargetLookup } from "../types";

/** A place a binding can read from: the workflow inputs, or one node's outputs. */
export type SourceGroup = {
  key: string;
  label: string;
  entity?: EntityIdentity;
  node?: string;
  fields: IoField[];
};

const field = (name: string, type: IoField["type"]): IoField => ({
  name,
  type,
  description: "",
  required: false,
});

/** The fields a node outputs, as bindings and conditions can read them. */
export function outputFields(node: WorkflowNode, lookup: TargetLookup): IoField[] {
  if (node.kind === "gate") {
    return [...schemaToFields(node.schema), field("approved", "bool"), field("comment", "long")];
  }
  const schema = lookup(node)?.outputSchema;
  if (!schema) return [];
  return hasFields(schema) ? schemaToFields(schema) : [field("text", "long")];
}

/** The fields a node takes: its target's inputs, or a gate's own fields. */
export function inputFields(node: WorkflowNode, lookup: TargetLookup): IoField[] {
  if (node.kind === "gate") return schemaToFields(node.schema);
  return schemaToFields(lookup(node)?.inputSchema ?? {});
}

/** Nodes with a path to `id`: what its bindings may read. */
export function upstreamOf(doc: WorkflowDocument, id: string): Set<string> {
  const found = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const edge of doc.edges) {
      if (edge.to === current && !found.has(edge.from)) {
        found.add(edge.from);
        queue.push(edge.from);
      }
    }
  }
  found.delete(id);
  return found;
}

/**
 * Sources for a node's bindings: workflow inputs, then upstream nodes.
 * `nodeId: null` is the output mapping, which may read any node.
 */
export function bindingSources(
  doc: WorkflowDocument,
  nodeId: string | null,
  lookup: TargetLookup,
): SourceGroup[] {
  const upstream = nodeId ? upstreamOf(doc, nodeId) : new Set(doc.nodes.map((n) => n.id));
  const nodes = doc.nodes.filter((n) => upstream.has(n.id));
  return [
    { key: "input", label: "Workflow input", fields: schemaToFields(doc.inputSchema) },
    ...nodes.map((node) => ({
      key: `node:${node.id}`,
      label: node.label || node.id,
      entity: node.kind === "gate" ? gateEntity : lookup(node)?.entity,
      node: node.id,
      fields: outputFields(node, lookup),
    })),
  ];
}
