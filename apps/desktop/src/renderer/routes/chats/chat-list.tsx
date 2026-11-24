import type { Chat } from "@agentic/contracts";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EntityAvatar,
  KeyHint,
} from "@agentic/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { Archive, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { showError } from "../../lib/show-error";
import { useChats, useRemoveChat, useUpdateChat } from "./queries";
import { useChatTargets } from "./use-chat-targets";

/** Every chat, most recent first, each with its target's avatar. */
export function ChatList() {
  const chats = useChats().data ?? [];
  return (
    <nav aria-label="Chats" className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h1 className="flex-1 font-serif text-lg">Chats</h1>
        <Button size="sm" asChild>
          <Link to="/chats" aria-label="New chat">
            <Plus aria-hidden /> New <KeyHint keys={["⌘", "N"]} />
          </Link>
        </Button>
      </div>
      {chats.length === 0 ? (
        <p className="px-3 text-sm text-fg-muted">Your chats show up here.</p>
      ) : (
        <ul className="grid min-h-0 content-start gap-0.5 overflow-auto px-2 pb-2">
          {chats.map((chat) => (
            <li key={chat.id}>
              <ChatRow chat={chat} />
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

function ChatRow({ chat }: { chat: Chat }) {
  const { find } = useChatTargets();
  const navigate = useNavigate();
  const identity = find(chat.target)?.identity;
  const update = useUpdateChat();
  const remove = useRemoveChat();
  const leave = () => void navigate({ to: "/chats" });
  const onError = (err: Error) => showError(err);
  return (
    <div className="group relative">
      <Link
        to="/chats/$chatId"
        params={{ chatId: chat.id }}
        className={cn(
          "flex items-center gap-2 rounded-control py-1.5 pr-8 pl-2 text-fg-muted",
          "hover:bg-surface-sunken hover:text-fg",
          "data-[status=active]:bg-accent-tint data-[status=active]:text-accent-ink",
        )}
      >
        {identity ? (
          <EntityAvatar color={identity.color} icon={identity.icon} size="sm" />
        ) : (
          <span className="size-5 shrink-0 rounded-[5px] bg-surface-sunken" />
        )}
        <span className="truncate">{chat.title || "New chat"}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Actions for ${chat.title || "this chat"}`}
            className="absolute top-1/2 right-0.5 size-6 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              update.mutate(
                { id: chat.id, input: { archived: true } },
                { onSuccess: leave, onError },
              )
            }
          >
            <Archive aria-hidden /> Archive
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => remove.mutate(chat.id, { onSuccess: leave, onError })}>
            <Trash2 aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
