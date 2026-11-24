import { CHAT_ASSISTANT_ID, parseWorkflowAssistantId } from "@agentic/contracts";
import { EmptyState, StatusPill } from "@agentic/ui";
import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { PendingGates } from "../../components/pending-gates";
import { useCoreQuery } from "../../lib/core-queries";
import { useChats } from "../chats/queries";
import { AssistantLabel } from "../runs/assistant-label";

/** Every gate waiting for a human, across all runs, answered in place (P4.8, P7.8). */
export function InboxPage() {
  const pending = useCoreQuery(["inbox"], (c) => c.inbox()).data ?? [];
  const chats = useChats().data ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-4 py-3">
        <h1 className="font-serif text-lg">Inbox</h1>
      </header>
      {pending.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing needs you"
          description="Gates waiting for your answer show up here, from every run."
        />
      ) : (
        <ul className="grid content-start gap-4 overflow-auto p-4">
          {pending.map(({ run, interrupts }) => {
            const workflow = parseWorkflowAssistantId(run.assistantId);
            const chat =
              run.assistantId === CHAT_ASSISTANT_ID
                ? chats.find((c) => c.threadId === run.threadId)
                : undefined;
            return (
              <li key={run.id} className="grid max-w-3xl gap-3">
                <div className="flex items-center gap-2">
                  <StatusPill status={run.status} />
                  <AssistantLabel assistantId={run.assistantId} version={run.assistantVersion} />
                  {chat ? (
                    <Link
                      to="/chats/$chatId"
                      params={{ chatId: chat.id }}
                      className="truncate text-accent-ink hover:underline"
                    >
                      {chat.title || "Chat"}
                    </Link>
                  ) : workflow ? (
                    <Link
                      to="/workflows/$workflowId/runs/$runId"
                      params={{ workflowId: workflow.workflowId, runId: run.id }}
                      className="font-mono text-code text-accent-ink hover:underline"
                    >
                      run {run.id.slice(-8)}
                    </Link>
                  ) : (
                    <span className="font-mono text-code text-fg-subtle">
                      run {run.id.slice(-8)}
                    </span>
                  )}
                </div>
                {interrupts.length === 0 ? (
                  <p className="text-fg-muted">The gate asks again when the run resumes.</p>
                ) : (
                  <PendingGates runId={run.id} interrupts={interrupts} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
