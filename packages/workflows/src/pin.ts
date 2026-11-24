import { AppError, type WorkflowDocument } from "@agentic/contracts";

/** The newest published version of each kind of target, or null when none is published. */
export interface LatestVersions {
  agent(agentId: string): Promise<number | null>;
  workflow(workflowId: string): Promise<number | null>;
}

/**
 * Replaces every `latest` pin with the newest published version, so a
 * published version or a draft snapshot always runs the same targets.
 */
export async function pinDocument(
  doc: WorkflowDocument,
  latest: LatestVersions,
): Promise<WorkflowDocument> {
  const nodes = await Promise.all(
    doc.nodes.map(async (node) => {
      if (node.kind === "gate" || node.version !== "latest") return node;
      const version =
        node.kind === "agent"
          ? await latest.agent(node.agentId)
          : await latest.workflow(node.workflowId);
      if (version === null) {
        throw new AppError("validation_failed", `"${node.id}" uses an unpublished ${node.kind}`);
      }
      return { ...node, version };
    }),
  );
  return { ...doc, nodes };
}
