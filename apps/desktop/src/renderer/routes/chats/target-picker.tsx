import type { ChatTarget } from "@agentic/contracts";
import { cn, EntityChip, Input } from "@agentic/ui";
import { useState } from "react";
import { type TargetOption, targetKey, useChatTargets } from "./use-chat-targets";

type Props = { value: ChatTarget; onChange: (target: ChatTarget) => void };

const groups: Array<{ label: string; kind: ChatTarget["kind"] }> = [
  { label: "App", kind: "app" },
  { label: "Agents", kind: "agent" },
  { label: "Workflows", kind: "workflow" },
];

/** Who a chat talks to, as colored chips. Drafts show but can't be picked until published. */
export function TargetPicker({ value, onChange }: Props) {
  const { options } = useChatTargets();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = options.filter(
    (o) => !q || o.identity.name.toLowerCase().includes(q) || o.slug.includes(q),
  );
  const selected = targetKey(value);
  return (
    <div className="grid gap-3">
      {options.length > 6 && (
        <Input
          aria-label="Find a target"
          placeholder="Find an agent or workflow"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {groups.map(({ label, kind }) => {
        const items = visible.filter((o) => o.target.kind === kind);
        if (items.length === 0) return null;
        return (
          <fieldset key={kind} className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-fg-muted">{label}</legend>
            <div className="flex flex-wrap gap-1.5">
              {items.map((option) => (
                <TargetButton
                  key={option.key}
                  option={option}
                  selected={option.key === selected}
                  onPick={() => onChange(option.target)}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function TargetButton({
  option,
  selected,
  onPick,
}: {
  option: TargetOption;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={!option.published}
      title={option.published ? option.description : "Publish it to chat with it"}
      onClick={onPick}
      className={cn(
        "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
        selected && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
      )}
    >
      <EntityChip entity={option.identity} />
    </button>
  );
}
