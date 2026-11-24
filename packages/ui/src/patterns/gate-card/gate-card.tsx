import {
  hasFields,
  humanAgentRequestSchema,
  type JsonValue,
  toolApprovalRequestSchema,
  workflowGateRequestSchema,
  workflowReviewRequestSchema,
} from "@agentic/contracts";
import { Hand } from "lucide-react";
import type { ReactNode } from "react";
import { MarkdownText } from "../output-view/markdown-output";
import { GateForm } from "./gate-form";
import { ToolApproval } from "./tool-approval";

export type GateCardProps = {
  /** The interrupt value a run is waiting on. */
  request: unknown;
  busy?: boolean;
  onAnswer: (answer: JsonValue) => void;
  /** Shown for a request kind the card doesn't know (e.g. a JSON answer). */
  fallback?: ReactNode;
};

/**
 * A human gate as a form: workflow gates and reviews (approve, edit,
 * reject), `human` agents (answer), and tool approvals. Requests it
 * doesn't know show `fallback`.
 */
export function GateCard({ request, busy, onAnswer, fallback = null }: GateCardProps) {
  const gate = workflowGateRequestSchema.safeParse(request);
  if (gate.success) {
    const { title, message, schema, data, issues } = gate.data;
    return (
      <Frame title={title} message={message}>
        <GateForm
          schema={schema}
          data={data}
          issues={issues}
          busy={busy}
          decide
          onAnswer={onAnswer}
        />
      </Frame>
    );
  }
  const review = workflowReviewRequestSchema.safeParse(request);
  if (review.success) {
    const { label, stage, schema, data, issues } = review.data;
    const title = `Review the ${stage} of ${label}`;
    const message =
      stage === "input"
        ? "Check or edit what this step will run with."
        : "Check or edit what this step produced.";
    return (
      <Frame title={title} message={message}>
        <GateForm
          schema={schema}
          data={data}
          issues={issues}
          busy={busy}
          decide
          onAnswer={onAnswer}
        />
      </Frame>
    );
  }
  const human = humanAgentRequestSchema.safeParse(request);
  if (human.success) {
    const { question, outputSchema, issues } = human.data;
    return (
      <Frame title="An agent asks" message={question}>
        <GateForm
          schema={outputSchema}
          data={{}}
          issues={issues}
          busy={busy}
          freeText={!hasFields(outputSchema)}
          onAnswer={onAnswer}
        />
      </Frame>
    );
  }
  const approval = toolApprovalRequestSchema.safeParse(request);
  if (approval.success) {
    const { scope } = approval.data;
    const title = scope === "call" ? "Approve a tool call" : "Approve tools for this run";
    const message =
      scope === "call"
        ? "The agent wants to run this tool with the input below."
        : "The agent may use these tools while it works. Rejecting runs it without them.";
    return (
      <Frame title={title} message={message}>
        <ToolApproval request={approval.data} busy={busy} onAnswer={onAnswer} />
      </Frame>
    );
  }
  return fallback;
}

function Frame({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Hand aria-hidden className="size-4 text-warning" />
        <h3 className="font-medium">{title}</h3>
      </div>
      {message && (
        <div className="rounded-control bg-surface-sunken p-3" data-selectable>
          <MarkdownText text={message} />
        </div>
      )}
      {children}
    </div>
  );
}
