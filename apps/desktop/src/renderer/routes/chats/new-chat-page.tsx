import type { ChatAttachment, ChatTarget } from "@agentic/contracts";
import { EntityChip, ScrollArea } from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChatComposer } from "./conversation/chat-composer";
import { useChatCommands } from "./conversation/use-chat-commands";
import { useCreateChat, useSendMessage } from "./queries";
import { TargetPicker } from "./target-picker";
import { useChatTargets } from "./use-chat-targets";

/** ⌘N: pick who to talk to (the App by default) and send the first message. */
export function NewChatPage() {
  const navigate = useNavigate();
  const [target, setTarget] = useState<ChatTarget>({ kind: "app" });
  const [workingDir, setWorkingDir] = useState<string | null>(null);
  const create = useCreateChat();
  const send = useSendMessage();
  const identity = useChatTargets().find(target)?.identity;
  const commands = useChatCommands({ setTarget, setWorkingDir });

  const start = async (text: string, attachments: ChatAttachment[]) => {
    const chat = await create.mutateAsync({ target, workingDir });
    await send.mutateAsync({ id: chat.id, text, attachments });
    await navigate({ to: "/chats/$chatId", params: { chatId: chat.id } });
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
          <div className="grid gap-1">
            <h2 className="font-serif text-2xl">New chat</h2>
            <p className="text-fg-muted">
              Talk to the App, or pick an agent or workflow: it asks for what it needs, runs, and
              answers here.
            </p>
          </div>
          <TargetPicker value={target} onChange={setTarget} />
          {workingDir && (
            <p className="text-sm text-fg-muted">
              Working dir: <span className="font-mono text-code">{workingDir}</span>
            </p>
          )}
        </div>
      </ScrollArea>
      <div className="mx-auto grid w-full max-w-3xl gap-2 px-4 pb-4">
        {identity && (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            To <EntityChip entity={identity} />
          </p>
        )}
        <ChatComposer
          onSend={start}
          onTarget={setTarget}
          commands={commands}
          placeholder="Message… (@ to pick who answers, / for commands)"
        />
      </div>
    </div>
  );
}
