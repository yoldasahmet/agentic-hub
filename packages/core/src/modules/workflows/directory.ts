import type { WorkflowDocument } from "@agentic/contracts";
import { type ResolvedWorkflow, resolveWorkflow } from "@agentic/workflows";
import { toWorkflow } from "./mappers";
import type { WorkflowReferences } from "./references";
import type { WorkflowRepository } from "./repository";

export type WorkflowSummary = ReturnType<typeof toWorkflow> & {
  workspaceId: string;
  archived: boolean;
};

/**
 * Read access to workflows for other modules (chats). Lookups are
 * unscoped for the job worker, which serves every workspace; callers
 * check `workspaceId`.
 */
export class WorkflowDirectory {
  constructor(
    private readonly repo: WorkflowRepository,
    private readonly refs: WorkflowReferences,
  ) {}

  async find(id: string): Promise<WorkflowSummary | undefined> {
    const row = await this.repo.getById(id);
    if (!row) return undefined;
    return { ...toWorkflow(row), workspaceId: row.workspaceId, archived: row.archivedAt !== null };
  }

  async published(workspaceId: string): Promise<WorkflowSummary[]> {
    const rows = await this.repo.listPublished(workspaceId);
    return rows.map((row) => ({
      ...toWorkflow(row),
      workspaceId: row.workspaceId,
      archived: false,
    }));
  }

  /** A published version's document. Versions are immutable, so the result can be cached. */
  async document(id: string, version: number): Promise<WorkflowDocument | undefined> {
    return this.refs.resolver.workflowDocument(id, version);
  }

  /** A version with every agent and subworkflow it runs, ready to compile. */
  resolve(id: string, document: WorkflowDocument): Promise<ResolvedWorkflow> {
    return resolveWorkflow(document, this.refs.resolver, [id]);
  }
}
