import { X } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "../lib/cn";
import { fieldClass } from "../primitives/input";

export type TagListInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Offered as the user types (a native datalist); free text still works. */
  suggestions?: readonly string[];
  id?: string;
  "aria-label"?: string;
  className?: string;
};

/** A list of short strings as removable chips. Enter or comma adds; Backspace on empty removes. */
export function TagListInput({
  value,
  onChange,
  placeholder,
  suggestions,
  className,
  ...rest
}: TagListInputProps) {
  const listId = useId();
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = draft.trim();
    if (next && !value.includes(next)) onChange([...value, next]);
    setDraft("");
  };
  return (
    <div className={cn(fieldClass, "flex min-h-8 flex-wrap items-center gap-1 py-1", className)}>
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-control bg-surface-sunken px-1.5 text-sm"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="text-fg-muted hover:text-fg"
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      <input
        {...rest}
        list={suggestions?.length ? listId : undefined}
        className="min-w-24 flex-1 bg-transparent outline-none placeholder:text-fg-subtle"
        placeholder={value.length === 0 ? placeholder : undefined}
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(",", ""))}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add();
          } else if (event.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
      />
      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      ) : null}
    </div>
  );
}
