import { cn } from "../../../lib/cn";
import type { ComposerSuggestion } from "./suggestions";

type Props = {
  id: string;
  items: ComposerSuggestion[];
  active: number;
  label: string;
  onPick: (item: ComposerSuggestion) => void;
  onHover: (index: number) => void;
};

/** The `/` and `@` list above the composer. Focus stays in the textarea; arrows move `active`. */
export function SuggestionMenu({ id, items, active, label, onPick, onHover }: Props) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label={label}
      className="absolute right-0 bottom-full left-0 mb-2 grid max-h-72 overflow-auto rounded-card border border-border bg-surface-raised p-1 shadow-2"
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          id={`${id}-${index}`}
          role="option"
          tabIndex={-1}
          aria-selected={index === active}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(item);
          }}
          onMouseEnter={() => onHover(index)}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5",
            index === active && "bg-accent-tint text-accent-ink",
          )}
        >
          {item.icon}
          <span className="font-medium">{item.label}</span>
          {item.detail && <span className="truncate text-sm text-fg-muted">{item.detail}</span>}
        </div>
      ))}
    </div>
  );
}
