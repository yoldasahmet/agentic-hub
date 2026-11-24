import { type CommandGroup, EntityAvatar } from "@agentic/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import { showError } from "../lib/show-error";
import { useCreateChat, useUpdateChat } from "../routes/chats/queries";
import { useChatTargets } from "../routes/chats/use-chat-targets";

/**
 * ⌘K "Chat with …": inside a chat it switches that chat's target; elsewhere
 * it starts a new chat with the target.
 */
export function useChatCommandsGroup(): CommandGroup {
  const navigate = useNavigate();
  const { chatId } = useParams({ strict: false });
  const { options } = useChatTargets();
  const create = useCreateChat();
  const update = useUpdateChat();
  const onError = (err: Error) => showError(err);
  return {
    heading: chatId ? "Switch this chat to" : "Chat with",
    items: options
      .filter((o) => o.published)
      .map((option) => ({
        id: `chat-${option.key}`,
        label: option.identity.name,
        keywords: [option.slug, option.target.kind, "chat"],
        visual: (
          <EntityAvatar color={option.identity.color} icon={option.identity.icon} size="xs" />
        ),
        onSelect: () => {
          if (chatId) {
            update.mutate({ id: chatId, input: { target: option.target } }, { onError });
            return;
          }
          create.mutate(
            { target: option.target },
            {
              onSuccess: (chat) =>
                void navigate({ to: "/chats/$chatId", params: { chatId: chat.id } }),
              onError,
            },
          );
        },
      })),
  };
}
