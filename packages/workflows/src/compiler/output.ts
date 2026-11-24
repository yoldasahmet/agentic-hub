import type { NodeSlot, WorkflowDocument } from "@agentic/contracts";
import { projectInput } from "../bindings";
import type { Topology } from "../topology";
import type { WorkflowValues } from "./state";

/**
 * The workflow output after a node wrote `slot`: the output mapping when
 * there is one, else the merged outputs of the exit nodes that have run.
 */
export function mapOutput(
  doc: WorkflowDocument,
  topo: Topology,
  state: WorkflowValues,
  nodeId: string,
  slot: NodeSlot,
): Record<string, unknown> {
  const nodes = { ...state.nodes, [nodeId]: slot };
  if (Object.keys(doc.outputs).length > 0) {
    return projectInput(doc.outputs, { input: state.input, nodes });
  }
  return topo.exits.includes(nodeId) ? { ...slot.output } : {};
}
