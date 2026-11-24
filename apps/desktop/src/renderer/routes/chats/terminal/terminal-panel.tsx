import type { Chat } from "@agentic/contracts";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@agentic/ui";
import { Play, SquareTerminal, X } from "lucide-react";
import { useState } from "react";
import { showError } from "../../../lib/show-error";
import { useUiStore } from "../../../stores/ui-store";
import { useProviders } from "../../settings/providers/queries";
import { useCloseTerminal, useOpenTerminal, useTerminals } from "../queries";
import { TerminalAttach, type TerminalAttachments } from "./terminal-attach";
import { TerminalView } from "./terminal-view";

/**
 * Terminal mode: the CLI's own interactive session in the chat's working
 * dir, for what a headless run can't do (sign-in prompts, TUI flows).
 */
export function TerminalPanel({ chat }: { chat: Chat }) {
  const clis = (useProviders().data ?? []).filter((p) => p.transport === "cli" && p.installed);
  const terminals = useTerminals().data;
  const stored = useUiStore((s) => s.terminals[chat.id]);
  const setTerminal = useUiStore((s) => s.setTerminal);
  const open = useOpenTerminal();
  const close = useCloseTerminal();
  const preferred = clis.find((p) => p.id === chat.model?.providerId) ?? clis[0];
  const [providerId, setProviderId] = useState<string>();
  const [attached, setAttached] = useState<TerminalAttachments>({ mcpServers: [], skills: [] });
  const chosen = providerId ?? preferred?.id;
  // After a Core restart the stored session is gone; offer a new one.
  const session = terminals?.find((t) => t.id === stored);
  const onError = (err: Error) => showError(err);

  return (
    <section aria-label="Terminal" className="flex h-full min-h-0 flex-col border-t border-border">
      <header className="flex items-center gap-2 px-3 py-1.5">
        <SquareTerminal aria-hidden className="size-4 text-fg-muted" />
        {session ? (
          <>
            <span className="truncate font-mono text-xs text-fg-muted" title={session.cwd}>
              {session.command.split("/").at(-1)} · {session.cwd}
            </span>
            <span className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                close.mutate(session.id, { onSuccess: () => setTerminal(chat.id, null), onError })
              }
            >
              <X aria-hidden /> End session
            </Button>
          </>
        ) : (
          <>
            <Select value={chosen} onValueChange={setProviderId} disabled={clis.length === 0}>
              <SelectTrigger aria-label="CLI" className="h-7 w-40">
                <SelectValue placeholder="No CLI installed" />
              </SelectTrigger>
              <SelectContent>
                {clis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TerminalAttach value={attached} onChange={setAttached} />
            <span className="flex-1" />
            <Button
              size="sm"
              variant="primary"
              disabled={!chosen || open.isPending}
              onClick={() =>
                chosen &&
                open.mutate(
                  { providerId: chosen, chatId: chat.id, ...attached },
                  { onSuccess: (t) => setTerminal(chat.id, t.id), onError },
                )
              }
            >
              <Play aria-hidden /> Start
            </Button>
          </>
        )}
      </header>
      <div className="min-h-0 flex-1">
        {session ? (
          <TerminalView terminalId={session.id} />
        ) : (
          <p className="p-3 text-sm text-fg-muted">
            Runs the CLI interactively in {chat.workingDir ?? "your home folder"}.
          </p>
        )}
      </div>
    </section>
  );
}
