import { type VersionPin, type WorkflowDocument, workflowDocumentSchema } from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import {
  type CatalogLookup,
  catalogKey,
  catalogRefs,
  type LatestVersions,
  type ValidationCatalog,
  type WorkflowResolver,
} from "@agentic/workflows";
import type { AgentDirectory } from "../agents/directory";
import type { WorkflowRepository } from "./repository";

const MAX_DEPTH = 8;

/**
 * Everything a workflow document refers to, seen from this workspace: the
 * validation catalog, `latest` pins, and the resolver for pinned versions.
 * Agents are read through the agents module's directory.
 */
export class WorkflowReferences {
  constructor(
    private readonly agents: AgentDirectory,
    private readonly repo: WorkflowRepository,
  ) {}

  latest(workspaceId: string): LatestVersions {
    return {
      agent: async (id) => {
        const agent = await this.agents.find(id);
        return agent?.workspaceId === workspaceId ? agent.latestVersion : null;
      },
      workflow: async (id) => {
        const row = await this.repo.getById(id);
        return row?.workspaceId === workspaceId ? row.latestVersion : null;
      },
    };
  }

  /** Immutable versions only, so a compiled graph never changes under a run. */
  readonly resolver: WorkflowResolver = {
    agentSpec: (id, version) => this.agents.spec(id, version),
    workflowDocument: async (id, version) => {
      const row = await this.repo.getVersion(id, version);
      return row ? workflowDocumentSchema.parse(row.document) : undefined;
    },
  };

  async catalog(ctx: LocalContext, doc: WorkflowDocument): Promise<ValidationCatalog> {
    const refs = catalogRefs(doc.nodes);
    const agents = new Map<string, CatalogLookup>();
    const workflows = new Map<string, CatalogLookup>();
    for (const { id, pin } of refs.agents)
      agents.set(catalogKey(id, pin), await this.agent(ctx, id, pin));
    for (const { id, pin } of refs.workflows) {
      workflows.set(catalogKey(id, pin), await this.workflow(ctx, id, pin));
    }
    return { agents, workflows };
  }

  private async agent(ctx: LocalContext, id: string, pin: VersionPin): Promise<CatalogLookup> {
    const agent = await this.agents.find(id);
    if (!agent || agent.workspaceId !== ctx.workspaceId) return { status: "missing" };
    const version = pin === "latest" ? agent.latestVersion : pin;
    const spec = version === null ? agent.draft : await this.agents.spec(id, version);
    if (!spec) return { status: "unknown_version" };
    const entry = {
      name: agent.name,
      inputSchema: spec.inputSchema,
      outputSchema: spec.outputSchema,
    };
    return { status: "ok", entry: { ...entry, published: version !== null } };
  }

  private async workflow(ctx: LocalContext, id: string, pin: VersionPin): Promise<CatalogLookup> {
    const found = await this.document(ctx.workspaceId, id, pin);
    if (found.status !== "ok") return found;
    const { name, doc, published } = found;
    const reaches = await this.reaches(ctx.workspaceId, id, doc, 0);
    const entry = { name, inputSchema: doc.inputSchema, outputSchema: doc.outputSchema, published };
    return { status: "ok", entry: { ...entry, reaches: [...reaches] } };
  }

  private async document(workspaceId: string, id: string, pin: VersionPin) {
    const row = await this.repo.getById(id);
    if (!row || row.workspaceId !== workspaceId) return { status: "missing" as const };
    const version = pin === "latest" ? row.latestVersion : pin;
    if (version === null) {
      const doc = workflowDocumentSchema.parse(row.draft);
      return { status: "ok" as const, name: row.name, doc, published: false };
    }
    const versionRow = await this.repo.getVersion(id, version);
    if (!versionRow) return { status: "unknown_version" as const };
    const doc = workflowDocumentSchema.parse(versionRow.document);
    return { status: "ok" as const, name: row.name, doc, published: true };
  }

  /** Workflow ids reachable from `doc` through subworkflow nodes, `id` included. */
  private async reaches(
    workspaceId: string,
    id: string,
    doc: WorkflowDocument,
    depth: number,
  ): Promise<Set<string>> {
    const found = new Set([id]);
    if (depth >= MAX_DEPTH) return found;
    for (const node of doc.nodes) {
      if (node.kind !== "workflow" || found.has(node.workflowId)) continue;
      const child = await this.document(workspaceId, node.workflowId, node.version);
      if (child.status !== "ok") continue;
      for (const reached of await this.reaches(
        workspaceId,
        node.workflowId,
        child.doc,
        depth + 1,
      )) {
        found.add(reached);
      }
    }
    return found;
  }
}
