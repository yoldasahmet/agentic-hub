import type { Assistant, Checkpoint } from "@agentic/contracts";
import { Button } from "@agentic/ui";
import { showError } from "../../lib/show-error";
import { GateAnswerForm } from "../inbox/gate-answer-form";
import { useCreateRun } from "./queries";

type Props = { threadId: string; assistantId: Assistant["id"]; head: Checkpoint };

/**
 * A thread with work left but no active run (a fork, or an edit after a
 * run ended): answer its gate or continue from the latest checkpoint.
 */
export function ContinueThreadCard({ threadId, assistantId, head }: Props) {
  const create = useCreateRun();
  const onError = (err: Error) => showError(err);

  return (
    <div className="grid gap-3 rounded-card border border-border bg-surface p-3 shadow-1">
      <p className="text-fg-muted">This thread can go on from its latest checkpoint.</p>
      {head.interrupts.length > 0 ? (
        <GateAnswerForm
          busy={create.isPending}
          onResume={(resume) => create.mutate({ assistantId, threadId, resume }, { onError })}
        />
      ) : (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="primary"
            disabled={create.isPending}
            onClick={() => create.mutate({ assistantId, threadId }, { onError })}
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
