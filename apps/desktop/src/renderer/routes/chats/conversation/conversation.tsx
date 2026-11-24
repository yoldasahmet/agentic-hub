import type { Chat, ChatAttachment, ChatMessage, ChatTarget } from "@agentic/contracts";
import { ChatMessageView, MessageList } from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { showError } from "../../../lib/show-error";
import { useRunEvents } from "../../../lib/use-run-events";
import { useCancelRun, useRun, useSendMessage, useTranscript, useUpdateChat } from "../queries";
import { ChatComposer } from "./chat-composer";
import { LiveTurn } from "./live-turn";
import { useChatCommands } from "./use-chat-commands";

type Props = {
  chat: Chat;
  header: ReactNode;
  terminalButton: ReactNode;
  toggleTerminal: () => void;
};

const LIVE = new Set(["queued", "running", "waiting"]);

/** Messages, the live turn, and the composer of one chat. */
export function Conversation({ chat, header, terminalButton, toggleTerminal }: Props) {
  const navigate = useNavigate();
  const transcript = useTranscript(chat.id).data;
  const run = useRun(transcript?.runId).data;
  const live = run !== undefined && LIVE.has(run.status);
  // Subscribing replays the run's events from the start, so a reload or reconnect loses nothing.
  const events = useRunEvents(live ? run.id : undefined);
  const send = useSendMessage();
  const update = useUpdateChat();
  const cancel = useCancelRun();
  const messages = transcript?.messages ?? [];
  const onError = (err: Error) => showError(err);
  const patch = (input: Parameters<typeof update.mutate>[0]["input"]) =>
    update.mutate({ id: chat.id, input }, { onError });

  const sendMessage = (text: string, attachments: ChatAttachment[]) =>
    send.mutateAsync({ id: chat.id, text, attachments });
  const setTarget = (target: ChatTarget) => patch({ target });
  const commands = useChatCommands({
    setTarget,
    setWorkingDir: (workingDir) => patch({ workingDir }),
    rename: (title) => patch({ title }),
    toggleTerminal,
    archive: () =>
      update.mutate(
        { id: chat.id, input: { archived: true } },
        { onSuccess: () => void navigate({ to: "/chats" }), onError },
      ),
  });
  const retry = (index: number) => {
    const question = messages.slice(0, index).findLast((m) => m.role === "user");
    if (question) sendMessage(question.text, question.attachments).catch(onError);
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      {header}
      {messages.length === 0 && !live ? (
        <div className="grid flex-1 place-content-center gap-1 p-8 text-center">
          <p className="font-serif text-lg">Say what you need</p>
          <p className="text-fg-muted">
            Type @ to talk to another agent or workflow, / for commands.
          </p>
        </div>
      ) : (
        <MessageList
          messages={messages}
          renderMessage={(message: ChatMessage, index) => (
            <ChatMessageView
              message={message}
              onRetry={message.error && !live ? () => retry(index) : undefined}
            />
          )}
          footer={<LiveTurn chat={chat} run={run} events={events} />}
          footerKey={`${events.length}:${run?.status}`}
        />
      )}
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <ChatComposer
          onSend={sendMessage}
          onTarget={setTarget}
          commands={commands}
          running={run?.status === "queued" || run?.status === "running"}
          onStop={() => run && cancel.mutate(run.id, { onError })}
          placeholder={
            run?.status === "waiting"
              ? "Answer above, or write a message…"
              : "Message… (@ to switch, / for commands)"
          }
          extra={terminalButton}
        />
      </div>
    </div>
  );
}
