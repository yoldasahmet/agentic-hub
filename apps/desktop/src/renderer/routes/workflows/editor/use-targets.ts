import type { Agent, Workflow, WorkflowDocument, WorkflowNode } from "@agentic/contracts";
import type { NodeTarget, PaletteItem, TargetLookup } from "@agentic/ui";
import { useCallback, useMemo } from "react";
import { useCoreQuery } from "../../../lib/core-queries";
import { useAgents } from "../../agents/queries";
import { useWorkflows } from "../queries";

type Schemas = Pick<NodeTarget, "inputSchema" | "outputSchema">;

// Stable while loading, so the lookup (and the canvas nodes) don't change every render.
const NONE_AGENTS: Agent[] = [];
const NONE_WORKFLOWS: Workflow[] = [];

/**
 * What the editor needs about each node's target: identity, published
 * versions, and the I/O schemas at the pinned version (the draft's, when
 * nothing is published yet). Also the palette's agents and workflows.
 */
export function useTargets(doc: WorkflowDocument, selfId: string) {
  const agents = useAgents().data ?? NONE_AGENTS;
  const archivedAgents = useAgents(true).data ?? NONE_AGENTS;
  const workflows = useWorkflows().data ?? NONE_WORKFLOWS;
  const agentIds = unique(doc.nodes.flatMap((n) => (n.kind === "agent" ? [n.agentId] : [])));
  const workflowIds = unique(
    doc.nodes.flatMap((n) => (n.kind === "workflow" ? [n.workflowId] : [])),
  );
  const versions = useCoreQuery(
    ["workflows", "targets", ...agentIds, "|", ...workflowIds],
    async (c) => {
      const [a, w] = await Promise.all([
        Promise.all(agentIds.map(async (id) => [id, await c.agents.versions(id)] as const)),
        Promise.all(workflowIds.map(async (id) => [id, await c.workflows.versions(id)] as const)),
      ]);
      return { agents: new Map(a), workflows: new Map(w) };
    },
  ).data;

  const lookup: TargetLookup = useCallback(
    (node: WorkflowNode) => {
      if (node.kind === "agent") {
        const agent =
          agents.find((x) => x.id === node.agentId) ??
          archivedAgents.find((x) => x.id === node.agentId);
        if (!agent) return undefined;
        const list = versions?.agents.get(agent.id) ?? [];
        const pinned = node.version === "latest" ? agent.latestVersion : node.version;
        const spec = pinned === null ? agent.draft : list.find((v) => v.version === pinned)?.spec;
        return target(
          agent,
          list.map((v) => v.version),
          agent.latestVersion,
          spec,
        );
      }
      if (node.kind === "workflow") {
        const workflow = workflows.find((x) => x.id === node.workflowId);
        if (!workflow) return undefined;
        const list = versions?.workflows.get(workflow.id) ?? [];
        const pinned = node.version === "latest" ? workflow.latestVersion : node.version;
        const document =
          pinned === null ? workflow.draft : list.find((v) => v.version === pinned)?.document;
        return target(
          workflow,
          list.map((v) => v.version),
          workflow.latestVersion,
          document,
        );
      }
      return undefined;
    },
    [agents, archivedAgents, workflows, versions],
  );

  const palette = useMemo(
    () => ({
      agents: agents.map(
        (a): PaletteItem => ({
          kind: "agent",
          id: a.id,
          entity: { name: a.name, color: a.color, icon: a.icon },
          description: a.latestVersion ? `v${a.latestVersion}` : "Not published",
        }),
      ),
      workflows: workflows
        .filter((w) => w.id !== selfId)
        .map(
          (w): PaletteItem => ({
            kind: "workflow",
            id: w.id,
            entity: { name: w.name, color: w.color, icon: w.icon },
            description: w.latestVersion ? `v${w.latestVersion}` : "Not published",
          }),
        ),
    }),
    [agents, workflows, selfId],
  );

  return { lookup, palette };
}

function target(
  entity: { name: string; color: NodeTarget["entity"]["color"]; icon: string },
  versions: number[],
  latestVersion: number | null,
  schemas: Schemas | undefined,
): NodeTarget {
  return {
    entity: { name: entity.name, color: entity.color, icon: entity.icon },
    inputSchema: schemas?.inputSchema ?? {},
    outputSchema: schemas?.outputSchema ?? {},
    versions,
    latestVersion,
  };
}

const unique = (ids: string[]) => [...new Set(ids)].sort();
