import {
  type EntityIdentity,
  entityIdentitySchema,
  type JsonSchema,
  type NodeStatus,
  type ValidationIssue,
  type WorkflowNode,
} from "@agentic/contracts";
import { z } from "zod";

/** What the editor knows about a node's agent or subworkflow at its pinned version. */
export type NodeTarget = {
  entity: EntityIdentity;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  /** Published versions, newest first. */
  versions: number[];
  latestVersion: number | null;
};
export type TargetLookup = (node: WorkflowNode) => NodeTarget | undefined;

export type Selection = { kind: "node"; id: string } | { kind: "edge"; id: string } | null;

/** A node's state in a live run: its last status, or waiting at a gate. */
export type LiveStatus = NodeStatus | "waiting";

export type { ValidationIssue };

/** What the palette adds: an agent, a subworkflow, or a gate (no id). Also the drag payload. */
export const paletteItemSchema = z.object({
  kind: z.enum(["agent", "workflow", "gate"]),
  id: z.string().optional(),
  entity: entityIdentitySchema,
  description: z.string().optional(),
});
export type PaletteItem = z.infer<typeof paletteItemSchema>;

/** Gates are not entities; they share one neutral look. */
export const gateEntity: EntityIdentity = { name: "Gate", color: "slate", icon: "hand" };
