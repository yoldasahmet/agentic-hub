import type { Chat } from "@agentic/contracts";
import { Button, EmptyState, ResizableGroup, ResizableHandle, ResizablePanel } from "@agentic/ui";
import { useParams } from "@tanstack/react-router";
import { MessageSquare, PanelRight, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { showError } from "../../lib/show-error";
import { useUiStore } from "../../stores/ui-store";
import { ContextPanel } from "./context/context-panel";
import { Conversation } from "./conversation/conversation";
import { TargetSwitch } from "./conversation/target-switch";
import { useChat, useUpdateChat } from "./queries";
import { TerminalPanel } from "./terminal/terminal-panel";

/** One chat: the conversation (with terminal mode below it) and the context panel. */
export function ChatPage() {
  const { chatId } = useParams({ from: "/chats/$chatId" });
  const chat = useChat(chatId);
  if (chat.error) {
    return (
      <EmptyState icon={MessageSquare} title="Chat not found" description={chat.error.message} />
    );
  }
  return chat.data ? <ChatView key={chat.data.id} chat={chat.data} /> : null;
}

function ChatView({ chat }: { chat: Chat }) {
  const hasSession = useUiStore((s) => chat.id in s.terminals);
  const [terminal, setTerminal] = useState(hasSession);
  const [context, setContext] = useState(true);
  const update = useUpdateChat();
  const toggleTerminal = () => setTerminal((open) => !open);

  const header = (
    <header className="flex items-center gap-2 border-b border-border px-4 py-2">
      <h2 className="min-w-0 truncate font-serif text-lg">{chat.title || "New chat"}</h2>
      <TargetSwitch
        value={chat.target}
        onChange={(target) =>
          update.mutate({ id: chat.id, input: { target } }, { onError: (err) => showError(err) })
        }
      />
      <span className="flex-1" />
      <Button
        size="icon"
        variant="ghost"
        aria-label={context ? "Hide the context panel" : "Show the context panel"}
        aria-pressed={context}
        onClick={() => setContext((open) => !open)}
      >
        <PanelRight aria-hidden />
      </Button>
    </header>
  );
  const terminalButton = (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Terminal mode"
      aria-pressed={terminal}
      onClick={toggleTerminal}
    >
      <SquareTerminal aria-hidden />
    </Button>
  );

  return (
    <ResizableGroup id="chat">
      <ResizablePanel id="chat-body" minSize="360px">
        <ResizableGroup id="chat-body-split" orientation="vertical" className="flex-col">
          <ResizablePanel id="conversation" minSize="200px">
            <Conversation
              chat={chat}
              header={header}
              terminalButton={terminalButton}
              toggleTerminal={toggleTerminal}
            />
          </ResizablePanel>
          {terminal && (
            <>
              <ResizableHandle className="h-px w-full after:inset-x-0 after:-top-1.5 after:-bottom-1.5" />
              <ResizablePanel id="terminal" defaultSize="40%" minSize="120px">
                <TerminalPanel chat={chat} />
              </ResizablePanel>
            </>
          )}
        </ResizableGroup>
      </ResizablePanel>
      {context && (
        <>
          <ResizableHandle />
          <ResizablePanel id="context" defaultSize="300px" minSize="240px" maxSize="520px">
            <div className="h-full overflow-auto bg-surface">
              <ContextPanel chat={chat} />
            </div>
          </ResizablePanel>
        </>
      )}
    </ResizableGroup>
  );
}
