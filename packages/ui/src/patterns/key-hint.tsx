import { cn } from "../lib/cn";

/** A keyboard shortcut, e.g. `<KeyHint keys={["⌘", "K"]} />`. */
export function KeyHint({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key) => (
        <kbd
          key={key}
          className="min-w-5 rounded-[4px] border border-border bg-surface px-1 text-center font-sans text-xs text-fg-muted"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
