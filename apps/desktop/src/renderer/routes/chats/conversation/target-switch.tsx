import type { ChatTarget } from "@agentic/contracts";
import { EntityChip, Popover, PopoverContent, PopoverTrigger } from "@agentic/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { TargetPicker } from "../target-picker";
import { useChatTargets } from "../use-chat-targets";

type Props = { value: ChatTarget; onChange: (target: ChatTarget) => void };

/** The chat's target as a chip; clicking it switches (so do `@mentions` and ⌘K). */
export function TargetSwitch({ value, onChange }: Props) {
  const { find } = useChatTargets();
  const [open, setOpen] = useState(false);
  const option = find(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Change who this chat talks to"
      >
        {option ? (
          <EntityChip entity={option.identity} />
        ) : (
          <span className="text-fg-muted">Missing target</span>
        )}
        <ChevronDown aria-hidden className="size-3.5 text-fg-muted" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96">
        <TargetPicker
          value={value}
          onChange={(target) => {
            onChange(target);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
