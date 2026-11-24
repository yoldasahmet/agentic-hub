import type { ChatAttachment } from "@agentic/contracts";
import { ArrowUp, Square } from "lucide-react";
import { type ReactNode, useId, useRef, useState } from "react";
import { cn } from "../../../lib/cn";
import { KeyHint } from "../../../patterns/key-hint";
import { Button } from "../../../primitives/button";
import { AttachmentChip } from "../attachment-chip";
import { SuggestionMenu } from "./suggestion-menu";
import {
  type ComposerSuggestion,
  matchSuggestions,
  parseCommand,
  suggestionQuery,
} from "./suggestions";

export type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  attachments: ChatAttachment[];
  onRemoveAttachment: (index: number) => void;
  onSubmit: () => void;
  /** `/command` at the start of a message. */
  commands: ComposerSuggestion[];
  onCommand: (id: string, arg: string) => void;
  /** `@name`: switches the chat's target. */
  mentions: ComposerSuggestion[];
  onMention: (id: string) => void;
  onDropFiles?: (files: File[]) => void;
  running?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Buttons left of send: attach, terminal mode, … */
  toolbar?: ReactNode;
};

/** The chat input: text, attachments, `/` commands, `@` mentions, and ⌘↵ to send. */
export function Composer(props: ComposerProps) {
  const { value, onChange, attachments, commands, mentions, running, disabled } = props;
  const menuId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string>();
  const query = suggestionQuery(value, caret);
  const items = query
    ? matchSuggestions(query.kind === "command" ? commands : mentions, query.query)
    : [];
  const open = items.length > 0 && dismissed !== value;
  const canSend = !disabled && !running && (value.trim() !== "" || attachments.length > 0);

  const pick = (item: ComposerSuggestion) => {
    if (query?.kind === "command") {
      if (item.arg) onChange(`/${item.id} `);
      else {
        onChange("");
        props.onCommand(item.id, "");
      }
    } else if (query?.kind === "mention") {
      onChange((value.slice(0, query.start) + value.slice(caret)).replace(/\s{2,}/g, " "));
      props.onMention(item.id);
    }
    setActive(0);
    ref.current?.focus();
  };

  const send = () => {
    const command = parseCommand(value, commands);
    if (command) {
      onChange("");
      props.onCommand(command.id, command.arg);
    } else if (canSend) {
      props.onSubmit();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step + items.length) % items.length);
        return;
      }
      const item = items[Math.min(active, items.length - 1)];
      if ((event.key === "Enter" || event.key === "Tab") && !event.metaKey && item) {
        event.preventDefault();
        pick(item);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissed(value);
        return;
      }
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send();
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a file drop zone; the attach button is the keyboard path
    <div
      className="relative grid gap-2 rounded-card border border-border-input bg-surface p-2 shadow-1 focus-within:ring-2 focus-within:ring-accent"
      onDragOver={(event) => {
        if (props.onDropFiles && event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!props.onDropFiles || event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        props.onDropFiles([...event.dataTransfer.files]);
      }}
    >
      {open && (
        <SuggestionMenu
          id={menuId}
          items={items}
          active={Math.min(active, items.length - 1)}
          label={query?.kind === "command" ? "Commands" : "Chat with"}
          onPick={pick}
          onHover={setActive}
        />
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {attachments.map((attachment, index) => (
            <AttachmentChip
              // biome-ignore lint/suspicious/noArrayIndexKey: chips are removed by position
              key={index}
              attachment={attachment}
              onRemove={() => props.onRemoveAttachment(index)}
            />
          ))}
        </div>
      )}
      <textarea
        ref={ref}
        aria-label="Message"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? `${menuId}-${Math.min(active, items.length - 1)}` : undefined}
        rows={2}
        value={value}
        disabled={disabled}
        placeholder={props.placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart);
          setActive(0);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        className={cn(
          "max-h-60 min-h-12 w-full resize-none bg-transparent px-1.5 py-1 outline-none [field-sizing:content]",
          "placeholder:text-fg-subtle disabled:opacity-60",
        )}
      />
      <div className="flex items-center gap-1">
        {props.toolbar}
        <span className="flex-1" />
        {running ? (
          <Button size="sm" onClick={props.onStop} aria-label="Stop">
            <Square aria-hidden /> Stop
          </Button>
        ) : (
          <>
            <KeyHint keys={["⌘", "↵"]} />
            <Button
              size="sm"
              variant="primary"
              disabled={!canSend}
              onClick={send}
              aria-label="Send"
            >
              <ArrowUp aria-hidden /> Send
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
