import { ResizableGroup, ResizableHandle, ResizablePanel } from "@agentic/ui";
import { Outlet } from "@tanstack/react-router";
import { ChatList } from "./chat-list";

/** Chats: the list on the left, then the open chat (or a new one). */
export function ChatsLayout() {
  return (
    <ResizableGroup id="chats">
      <ResizablePanel id="chat-list" defaultSize="240px" minSize="180px" maxSize="420px">
        <ChatList />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="chat-main" minSize="420px">
        <Outlet />
      </ResizablePanel>
    </ResizableGroup>
  );
}
