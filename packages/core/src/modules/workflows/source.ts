import type { AgentRuntimeDeps } from "@agentic/agents";
import {
  AppError,
  type Assistant,
  draftAssistantVersion,
  draftRevisionOf,
  parseWorkflowAssistantId,
  workflowDocumentSchema,
} from "@agentic/contracts";
import type { AssistantDefinition, AssistantSource } from "@agentic/graph";
import { resolveWorkflow, workflowDefinition } from "@agentic/workflows";
import type { WorkflowReferences } from "./references";
import type { WorkflowRepository } from "./repository";

/**
 * Resolves `workflow:<id>` (published versions) and `workflow-draft:<id>`
 * (a draft snapshot, version = revision + 1) from the DB, then
 * compiles the pinned document with everything it references.
 */
export class WorkflowAssistantSource implements AssistantSource {
  constructor(
    private readonly repo: WorkflowRepository,
    private readonly refs: WorkflowReferences,
    private readonly deps: AgentRuntimeDeps,
  ) {}

  matches(id: string): boolean {
    return parseWorkflowAssistantId(id) !== undefined;
  }

  async latest(id: string, workspaceId: string): Promise<Assistant> {
    const { workflow, draft } = await this.load(id);
    if (workflow.workspaceId !== workspaceId) throw notFound(id);
    if (workflow.archivedAt)
      throw new AppError("conflict", `Workflow ${workflow.name} is archived`);
    const version = draft ? draftAssistantVersion(workflow.revision) : workflow.latestVersion;
    if (version === null || version < 1) {
      throw new AppError("conflict", `Workflow ${workflow.name} has no published version`);
    }
    // A draft's revision moves on while it is edited; its snapshot is read only when it runs.
    const nodes = draft ? [] : (await this.definition(id, version)).nodes;
    return { ...meta(workflow, id, version, draft), nodes };
  }

  async definition(id: string, version: number): Promise<AssistantDefinition> {
    const { workflow, workflowId, draft } = await this.load(id);
    const raw = draft
      ? await this.repo.getSnapshot(workflowId, draftRevisionOf(version))
      : (await this.repo.getVersion(workflowId, version))?.document;
    if (raw === undefined) {
      const what = draft ? `draft snapshot r${draftRevisionOf(version)}` : `version ${version}`;
      throw new AppError("not_found", `Workflow ${workflow.name} has no ${what}`);
    }
    const document = workflowDocumentSchema.parse(raw);
    const resolved = await resolveWorkflow(document, this.refs.resolver, [workflowId]);
    return workflowDefinition(meta(workflow, id, version, draft), resolved, this.deps);
  }

  private async load(id: string) {
    const ref = parseWorkflowAssistantId(id);
    const workflow = ref ? await this.repo.getById(ref.workflowId) : undefined;
    if (!ref || !workflow) throw notFound(id);
    return { workflow, workflowId: ref.workflowId, draft: ref.draft };
  }
}

function meta(
  workflow: { name: string; description: string },
  id: string,
  version: number,
  draft: boolean,
) {
  return {
    id,
    name: draft ? `${workflow.name} (draft)` : workflow.name,
    description: workflow.description,
    version,
  };
}

const notFound = (id: string) => new AppError("not_found", `Unknown assistant ${id}`);
