import {
  type AgentSpec,
  AppError,
  type VersionPin,
  type WorkflowDocument,
} from "@agentic/contracts";

/** A pinned document with everything it runs, loaded up front so compiling is synchronous. */
export type ResolvedWorkflow = {
  document: WorkflowDocument;
  agents: ReadonlyMap<string, AgentSpec>;
  workflows: ReadonlyMap<string, ResolvedWorkflow>;
};

/** Immutable versions only: what a pinned document refers to never changes. */
export interface WorkflowResolver {
  agentSpec(agentId: string, version: number): Promise<AgentSpec | undefined>;
  workflowDocument(workflowId: string, version: number): Promise<WorkflowDocument | undefined>;
}

export const refKey = (id: string, version: number) => `${id}@${version}`;

const MAX_DEPTH = 8;

/**
 * Loads every agent spec and subworkflow a pinned document uses,
 * recursively. `chain` holds the workflows above this one, so a
 * subworkflow that leads back to one of them is refused.
 */
export async function resolveWorkflow(
  document: WorkflowDocument,
  resolver: WorkflowResolver,
  chain: string[],
): Promise<ResolvedWorkflow> {
  if (chain.length > MAX_DEPTH) {
    throw new AppError("validation_failed", "Subworkflows are nested too deeply");
  }
  const agents = new Map<string, AgentSpec>();
  const workflows = new Map<string, ResolvedWorkflow>();
  for (const node of document.nodes) {
    if (!node.enabled || node.kind === "gate") continue;
    const version = pinned(node.version, node.id);
    if (node.kind === "agent") {
      const spec = await resolver.agentSpec(node.agentId, version);
      if (!spec) throw missing(node.id, "agent", version);
      agents.set(refKey(node.agentId, version), spec);
      continue;
    }
    if (chain.includes(node.workflowId)) {
      throw new AppError("validation_failed", `"${node.id}" would run a workflow inside itself`);
    }
    const child = await resolver.workflowDocument(node.workflowId, version);
    if (!child) throw missing(node.id, "workflow", version);
    const resolved = await resolveWorkflow(child, resolver, [...chain, node.workflowId]);
    workflows.set(refKey(node.workflowId, version), resolved);
  }
  return { document, agents, workflows };
}

export function pinned(pin: VersionPin, node: string): number {
  if (pin === "latest") {
    throw new AppError("internal", `"${node}" was not pinned to a version before compiling`);
  }
  return pin;
}

const missing = (node: string, what: string, version: number) =>
  new AppError("not_found", `"${node}" uses a ${what} version (v${version}) that doesn't exist`);
