import {
  EmptyState,
  EventStream,
  JsonView,
  type Selection,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  WorkflowCanvas,
} from "@agentic/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { useState } from "react";
import { PendingGates } from "../../../components/pending-gates";
import { useCoreQuery, useRunEventsRefresh } from "../../../lib/core-queries";
import { showError } from "../../../lib/show-error";
import { useRunEvents } from "../../../lib/use-run-events";
import { ThreadPanel } from "../../runs/thread-panel";
import { useTargets } from "../editor/use-targets";
import { useRetryRun, useWorkflow } from "../queries";
import { stateOf } from "../runs/run-summary";
import { liveStatuses, nodeEvents } from "./live-status";
import { NodeDetail } from "./node-detail";
import { RunHeader } from "./run-header";

const STOPPED = new Set(["succeeded", "failed", "canceled"]);

/** `/workflows/$workflowId/runs/$runId`: the run on its canvas, live, with its gates and state. */
export function WorkflowRunPage() {
  const { workflowId, runId } = useParams({ from: "/workflows/$workflowId/runs/$runId" });
  const navigate = useNavigate();
  const workflow = useWorkflow(workflowId).data;
  const run = useCoreQuery(["runs", runId], (c) => c.runs.get(runId)).data;
  const doc = useCoreQuery(["runs", runId, "document"], (c) => c.workflows.runDocument(runId)).data;
  const thread = useCoreQuery(
    ["threads", run?.threadId, "state"],
    (c) => c.threads.state(run?.threadId ?? ""),
    !!run,
  );
  useRunEventsRefresh(runId);
  const events = useRunEvents(runId);
  const retry = useRetryRun();
  const [selection, setSelection] = useState<Selection>(null);
  // The thread's latest checkpoint is ahead of the run row while it runs.
  const state = stateOf(thread.data?.state?.values ?? run?.output);
  // The last checkpoint can still contain the answered gate while its node resumes.
  const interrupts = run?.status === "waiting" ? (thread.data?.state?.interrupts ?? []) : [];
  const statuses = run ? liveStatuses(run, state, events, interrupts) : {};
  const runCounts = Object.fromEntries(
    Object.entries(state.nodes).map(([id, slot]) => [id, slot.runs]),
  );
  const { lookup } = useTargets(doc ?? emptyDoc, workflowId);

  if (!workflow || !run || !doc) {
    return (
      <EmptyState
        icon={Activity}
        title="Loading run…"
        description="Fetching the run and the workflow it ran."
      />
    );
  }
  const node =
    selection?.kind === "node" ? doc.nodes.find((n) => n.id === selection.id) : undefined;
  const retryFrom = (id: string) =>
    retry.mutate(
      { runId, input: { node: id } },
      {
        onSuccess: (next) =>
          void navigate({
            to: "/workflows/$workflowId/runs/$runId",
            params: { workflowId, runId: next.id },
          }),
        onError: (err) => showError(err),
      },
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RunHeader workflow={workflow} run={run} />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <WorkflowCanvas
            document={doc}
            lookup={lookup}
            selection={selection}
            onSelect={setSelection}
            statuses={statuses}
            runs={runCounts}
          />
        </div>
        <aside className="flex w-[26rem] shrink-0 flex-col border-l border-border bg-surface">
          <Tabs defaultValue="run" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="px-4">
              <TabsTrigger value="run">Run</TabsTrigger>
              <TabsTrigger value="state">State</TabsTrigger>
            </TabsList>
            <TabsContent
              value="run"
              className="grid min-h-0 flex-1 content-start gap-4 overflow-auto p-4"
            >
              <PendingGates runId={run.id} interrupts={interrupts} />
              {node ? (
                <NodeDetail
                  node={node}
                  slot={state.nodes[node.id]}
                  status={statuses[node.id]}
                  events={events}
                  lookup={lookup}
                  onRetryFrom={STOPPED.has(run.status) ? () => retryFrom(node.id) : undefined}
                />
              ) : (
                <>
                  <section className="grid gap-1.5">
                    <h3 className="text-sm font-medium">Output</h3>
                    <JsonView value={state.output} />
                  </section>
                  <section className="grid gap-1.5">
                    <h3 className="text-sm font-medium">Events</h3>
                    <EventStream events={nodeEvents(events, null)} />
                  </section>
                </>
              )}
            </TabsContent>
            <TabsContent value="state" className="min-h-0 flex-1 overflow-auto">
              <ThreadPanel
                threadId={run.threadId}
                onForked={() => toast.success("Forked: continue it from the State tab")}
              />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}

const emptyDoc = { inputSchema: {}, outputSchema: {}, outputs: {}, nodes: [], edges: [] };
