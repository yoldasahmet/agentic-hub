import type { ChatAttachment, ChatTarget } from "@agentic/contracts";
import { Button, Composer, type ComposerSuggestion, EntityAvatar } from "@agentic/ui";
import { Paperclip } from "lucide-react";
import { type ReactNode, useState } from "react";
import { invoke } from "../../../lib/bridge";
import { showError } from "../../../lib/show-error";
import { useChatTargets } from "../use-chat-targets";
import { droppedAttachments, fileAttachment } from "./attachments";
import { ItemAttachButton } from "./item-attach-button";

export type ChatCommand = ComposerSuggestion & { run: (arg: string) => void };

type Props = {
  onSend: (text: string, attachments: ChatAttachment[]) => Promise<unknown>;
  onTarget: (target: ChatTarget) => void;
  commands: ChatCommand[];
  running?: boolean;
  onStop?: () => void;
  placeholder?: string;
  /** More toolbar buttons (terminal mode). */
  extra?: ReactNode;
};

/**
 * The chat's composer: keeps the draft and its attachments, completes
 * `@target` mentions (switching the target) and `/commands`, and adds
 * files from the picker or by drag and drop.
 */
export function ChatComposer({ onSend, onTarget, commands, running, ...props }: Props) {
  const { options } = useChatTargets();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const add = (more: ChatAttachment[]) => setAttachments((current) => [...current, ...more]);

  const mentions: ComposerSuggestion[] = options
    .filter((o) => o.published)
    .map((o) => ({
      id: o.key,
      label: o.identity.name,
      detail: o.target.kind === "app" ? "App" : `${o.target.kind} · ${o.slug}`,
      icon: <EntityAvatar color={o.identity.color} icon={o.identity.icon} size="xs" />,
    }));

  const submit = async () => {
    setSending(true);
    try {
      await onSend(text, attachments);
      setText("");
      setAttachments([]);
    } catch (err) {
      showError(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Composer
      value={text}
      onChange={setText}
      attachments={attachments}
      onRemoveAttachment={(index) => setAttachments((all) => all.filter((_, i) => i !== index))}
      onSubmit={() => void submit()}
      commands={commands}
      onCommand={(id, arg) => commands.find((c) => c.id === id)?.run(arg)}
      mentions={mentions}
      onMention={(key) => {
        const option = options.find((o) => o.key === key);
        if (option) onTarget(option.target);
      }}
      onDropFiles={(files) => add(droppedAttachments(files))}
      running={running}
      onStop={props.onStop}
      disabled={sending}
      placeholder={props.placeholder}
      toolbar={
        <>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Attach files"
            onClick={async () => {
              try {
                add((await invoke("dialog.openFiles", undefined)).map(fileAttachment));
              } catch (err) {
                showError(err);
              }
            }}
          >
            <Paperclip aria-hidden />
          </Button>
          <ItemAttachButton onAdd={(item) => add([item])} />
          {props.extra}
        </>
      }
    />
  );
}
