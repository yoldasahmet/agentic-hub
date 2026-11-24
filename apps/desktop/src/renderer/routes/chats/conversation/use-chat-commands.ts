import type { ChatTarget } from "@agentic/contracts";
import { toast } from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { useChatTargets } from "../use-chat-targets";
import type { ChatCommand } from "./chat-composer";

export type ChatActions = {
  setTarget: (target: ChatTarget) => void;
  setWorkingDir: (path: string | null) => void;
  rename?: (title: string) => void;
  toggleTerminal?: () => void;
  archive?: () => void;
};

/** The `/` commands. Ones that need a chat (rename, terminal, archive) appear once it exists. */
export function useChatCommands(actions: ChatActions): ChatCommand[] {
  const navigate = useNavigate();
  const { options } = useChatTargets();
  const switchTo = (kind: "agent" | "workflow", arg: string) => {
    const q = arg.trim().toLowerCase();
    const match = options.find(
      (o) =>
        o.target.kind === kind &&
        o.published &&
        (o.slug === q || o.identity.name.toLowerCase().startsWith(q)),
    );
    if (match) actions.setTarget(match.target);
    else toast.error(`No published ${kind} matches "${arg}". Try @ to pick one.`);
  };
  const commands: Array<ChatCommand | false | undefined> = [
    {
      id: "app",
      label: "/app",
      detail: "Talk to the App",
      run: () => actions.setTarget({ kind: "app" }),
    },
    {
      id: "agent",
      label: "/agent",
      detail: "Talk to an agent",
      arg: "name",
      run: (a) => switchTo("agent", a),
    },
    {
      id: "workflow",
      label: "/workflow",
      detail: "Run a workflow",
      arg: "name",
      run: (a) => switchTo("workflow", a),
    },
    {
      id: "cwd",
      label: "/cwd",
      detail: "Set the working dir (empty clears it)",
      arg: "path",
      run: (a) => actions.setWorkingDir(a.trim() || null),
    },
    actions.rename && {
      id: "title",
      label: "/title",
      detail: "Rename this chat",
      arg: "title",
      run: (a) => actions.rename?.(a),
    },
    actions.toggleTerminal && {
      id: "terminal",
      label: "/terminal",
      detail: "Open or close terminal mode",
      run: () => actions.toggleTerminal?.(),
    },
    {
      id: "new",
      label: "/new",
      detail: "Start a new chat",
      run: () => void navigate({ to: "/chats" }),
    },
    actions.archive && {
      id: "archive",
      label: "/archive",
      detail: "Archive this chat",
      run: () => actions.archive?.(),
    },
  ];
  return commands.filter((c): c is ChatCommand => Boolean(c));
}
