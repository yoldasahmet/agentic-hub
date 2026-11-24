import { chatInputsRequestSchema, type Interrupt } from "@agentic/contracts";
import { GateCard, InputsCard, JsonView } from "@agentic/ui";
import { showError } from "../lib/show-error";
import { GateAnswerForm } from "../routes/inbox/gate-answer-form";
import { useAnswerGate } from "../routes/workflows/queries";

type Props = { runId: string; interrupts: Interrupt[] };

/**
 * What a run waits on (Inbox, run view, Runs, chat), answered in place:
 * gates and reviews, `human` agents, and a chat's inputs card. Each answer
 * targets its own interrupt.
 */
export function PendingGates({ runId, interrupts }: Props) {
  const answer = useAnswerGate();
  if (interrupts.length === 0) return null;
  return (
    <div className="grid gap-3">
      {interrupts.map((interrupt) => {
        const onAnswer = (resume: Parameters<typeof answer.mutate>[0]["resume"]) =>
          answer.mutate(
            { runId, resume, interruptId: interrupt.id },
            { onError: (err) => showError(err) },
          );
        const inputs = chatInputsRequestSchema.safeParse(interrupt.value);
        if (inputs.success) {
          return (
            <InputsCard
              key={interrupt.id}
              request={inputs.data}
              busy={answer.isPending}
              onSubmit={(values) => onAnswer({ kind: "inputs", values })}
              onCancel={() => onAnswer({ kind: "cancel" })}
            />
          );
        }
        return (
          <section
            key={interrupt.id}
            className="rounded-card border border-warning bg-surface p-4 shadow-1"
          >
            <GateCard
              request={interrupt.value}
              busy={answer.isPending}
              onAnswer={onAnswer}
              fallback={
                <div className="grid gap-2">
                  <span className="text-fg-muted">{interrupt.node} asks:</span>
                  <JsonView value={interrupt.value} />
                  <GateAnswerForm busy={answer.isPending} onResume={onAnswer} />
                </div>
              }
            />
          </section>
        );
      })}
    </div>
  );
}
