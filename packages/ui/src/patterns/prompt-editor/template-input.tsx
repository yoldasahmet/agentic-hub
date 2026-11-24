import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { Textarea } from "../../primitives/input";
import { applyCompletion, type Completion, completionAt } from "./completions";

export type TemplateInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Input field names offered after `{{`. */
  fields: string[];
  id?: string;
  placeholder?: string;
  className?: string;
};

/**
 * A prompt template textarea that suggests `{{input.<field>}}` after `{{`.
 * Arrows pick, Enter or Tab inserts, Esc closes.
 */
export function TemplateInput({
  value,
  onChange,
  fields,
  id,
  placeholder,
  className,
}: TemplateInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState<Completion>();
  const [active, setActive] = useState(0);
  // Where the caret goes once React has written the completed value.
  const caret = useRef<number>(undefined);
  useLayoutEffect(() => {
    if (caret.current === undefined || ref.current?.value !== value) return;
    ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = undefined;
  }, [value]);
  const options = open
    ? fields.filter((f) => f.toLowerCase().startsWith(open.query.toLowerCase()))
    : [];
  const listId = `${id ?? "template"}-fields`;

  const refresh = (el: HTMLTextAreaElement) => {
    setOpen(completionAt(el.value, el.selectionStart));
    setActive(0);
  };
  const pick = (field: string) => {
    const el = ref.current;
    if (!el || !open) return;
    const next = applyCompletion(el.value, el.selectionStart, open, field);
    caret.current = next.caret;
    onChange(next.text);
    setOpen(undefined);
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        id={id}
        spellCheck={false}
        placeholder={placeholder}
        className={cn("min-h-40 font-mono text-code", className)}
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          refresh(event.target);
        }}
        onClick={(event) => refresh(event.currentTarget)}
        onBlur={() => setOpen(undefined)}
        onKeyDown={(event) => {
          if (options.length === 0) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (i + step + options.length) % options.length);
          } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            pick(options[active] ?? options[0] ?? "");
          } else if (event.key === "Escape") {
            event.stopPropagation();
            setOpen(undefined);
          }
        }}
      />
      {options.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-2 z-10 mt-1 min-w-48 rounded-control border border-border bg-surface-raised py-1 shadow-2"
        >
          {options.map((field, index) => (
            <div
              key={field}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              className="cursor-pointer px-2.5 py-1 font-mono text-code aria-selected:bg-accent-tint aria-selected:text-accent-ink"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(field);
              }}
            >
              input.{field}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
