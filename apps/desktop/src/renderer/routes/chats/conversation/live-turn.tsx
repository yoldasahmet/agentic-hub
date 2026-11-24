import {
  type Chat,
  type Run,
  type RunEvent,
  workflowGateRequestSchema,
  workflowReviewRequestSchema,
} from "@agentic/contracts";
import { TurnProgress } from "@agentic/ui";
import { AlertTriangle } from "lucide-react";
import { PendingGates } from "../../../components/pending-gates";
import { useThreadState } from "../../agents/queries";
import { providerNames, useProviders } from "../../settings/providers/queries";

type Props = { chat: Chat; run: Run | undefined; events: RunEvent[] };

/**
 * The turn in progress under the last message: its steps and streamed
 * output, then whatever it waits on (the inputs card or a gate). Once the
 * run finishes, the answer is a message and this shows nothing.
 */
export function LiveTurn({ chat, run, events }: Props) {
  const names = providerNames(useProviders().data);
  const waiting = run?.status === "waiting";
  const state = useThreadState(waiting ? chat.threadId : undefined).data?.state;
  const interrupts = state?.interrupts ?? [];
  if (!run) return null;
  const active = run.status === "queued" || run.status === "running";
  if (!active && !waiting) {
    return run.status === "failed" && run.error ? (
      <p className="flex items-center gap-2 rounded-control bg-danger-tint px-3 py-2 text-danger-ink">
        <AlertTriangle aria-hidden className="size-4" /> {run.error.message}
      </p>
    ) : null;
  }
  return (
    <div className="grid gap-3">
      <TurnProgress
        events={events}
        active={active}
        waitingNodes={interrupts.flatMap((i) => gateNode(i.value) ?? [])}
        providerNames={names}
      />
      <PendingGates runId={run.id} interrupts={interrupts} />
    </div>
  );
}

function gateNode(value: unknown): string | undefined {
  const gate = workflowGateRequestSchema.safeParse(value);
  if (gate.success) return gate.data.node;
  const review = workflowReviewRequestSchema.safeParse(value);
  return review.success ? review.data.node : undefined;
}
