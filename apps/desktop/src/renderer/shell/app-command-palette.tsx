import { type CommandGroup, CommandPalette } from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, MessageSquarePlus } from "lucide-react";
import { useUiStore } from "../stores/ui-store";
import { navItems, settingsItem } from "./nav-items";
import { useChatCommandsGroup } from "./use-chat-commands-group";

/** ⌘K: go to any section, create, or open a settings page. */
export function AppCommandPalette() {
  const open = useUiStore((state) => state.paletteOpen);
  const setOpen = useUiStore((state) => state.setPaletteOpen);
  const navigate = useNavigate();
  const chatGroup = useChatCommandsGroup();

  const groups: CommandGroup[] = [
    {
      heading: "Go to",
      items: [...navItems, settingsItem].map((item) => ({
        id: `go${item.path}`,
        label: item.label,
        icon: item.icon,
        shortcut: item === settingsItem ? ["⌘", ","] : undefined,
        onSelect: () => void navigate({ to: item.path }),
      })),
    },
    {
      heading: "Create",
      items: [
        {
          id: "new-chat",
          label: "New chat",
          icon: MessageSquarePlus,
          shortcut: ["⌘", "N"],
          onSelect: () => void navigate({ to: "/chats" }),
        },
      ],
    },
    chatGroup,
    {
      heading: "Settings",
      items: [
        {
          id: "settings-secrets",
          label: "Secrets",
          icon: KeyRound,
          keywords: ["api key", "token", "keychain"],
          onSelect: () => void navigate({ to: "/settings/secrets" }),
        },
      ],
    },
  ];

  return <CommandPalette open={open} onOpenChange={setOpen} groups={groups} />;
}
