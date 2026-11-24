import {
  AppError,
  draftAssistantVersion,
  draftRevisionOf,
  parseWorkflowAssistantId,
  type RetryWorkflowRunInput,
  type Run,
  type RunWorkflowInput,
  reviewStepName,
  runWorkflowInputSchema,
  type WorkflowDocument,
  workflowAssistantId,
  workflowDraftAssistantId,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import type { GraphRuntime } from "@agentic/graph";
import { checkJsonSchema } from "@agentic/llm";
import type { WorkflowService } from "./service";

const STOPPED = new Set(["succeeded", "failed", "canceled"]);

/** Starts workflow runs (draft snapshots or versions) and retries stopped ones. */
export class WorkflowRunner {
  constructor(
    private readonly workflows: WorkflowService,
    private readonly graph: GraphRuntime,
  ) {}

  async run(ctx: LocalContext, id: string, raw: RunWorkflowInput): Promise<Run> {
    const { version, input } = runWorkflowInputSchema.parse(raw);
    const workflow = await this.workflows.get(ctx, id);
    const doc =
      version === "draft" ? workflow.draft : (await this.workflows.version(id, version)).document;
    const checked = checkJsonSchema(doc.inputSchema, input);
    if (!checked.ok) {
      throw new AppError("validation_failed", "Some inputs are missing or invalid", {
        issues: checked.issues,
      });
    }
    if (version === "draft") await this.workflows.snapshot(ctx, workflow);
    return this.graph.runs.create(ctx, {
      assistantId: version === "draft" ? workflowDraftAssistantId(id) : workflowAssistantId(id),
      assistantVersion: version === "draft" ? draftAssistantVersion(workflow.revision) : version,
      input: { input },
    });
  }

  /** The pinned document a run executes: its version, or the draft snapshot it started from. */
  async document(ctx: LocalContext, runId: string): Promise<WorkflowDocument> {
    const run = await this.graph.runs.get(ctx, runId);
    const ref = parseWorkflowAssistantId(run.assistantId);
    if (!ref) throw new AppError("validation_failed", "This run is not a workflow run");
    await this.workflows.get(ctx, ref.workflowId);
    return ref.draft
      ? this.workflows.snapshotDocument(ref.workflowId, draftRevisionOf(run.assistantVersion))
      : (await this.workflows.version(ref.workflowId, run.assistantVersion)).document;
  }

  /**
   * Without a node, continues the thread of a failed or canceled run, which
   * runs its failed node again. With a node, forks the thread at the last
   * checkpoint before that node ran and continues the fork.
   */
  async retry(ctx: LocalContext, runId: string, { node }: RetryWorkflowRunInput): Promise<Run> {
    const run = await this.graph.runs.get(ctx, runId);
    if (!parseWorkflowAssistantId(run.assistantId)) {
      throw new AppError("validation_failed", "Only workflow runs can be retried from a node");
    }
    if (!STOPPED.has(run.status)) {
      throw new AppError("conflict", `Run ${runId} is ${run.status}; cancel it first`);
    }
    if (!node) {
      if (run.status === "succeeded") throw new AppError("conflict", "This run already succeeded");
      return this.graph.runs.create(ctx, { assistantId: run.assistantId, threadId: run.threadId });
    }
    const steps = new Set([node, reviewStepName(node, "input")]);
    const history = await this.graph.threads.history(ctx, run.threadId, { limit: 200 });
    const before = history.find((checkpoint) => checkpoint.next.some((step) => steps.has(step)));
    if (!before) throw new AppError("not_found", `"${node}" never ran in this run`);
    const fork = await this.graph.threads.fork(ctx, run.threadId, {
      checkpointId: before.checkpointId,
      keepPendingWrites: false,
    });
    return this.graph.runs.create(ctx, { assistantId: run.assistantId, threadId: fork.id });
  }
}
