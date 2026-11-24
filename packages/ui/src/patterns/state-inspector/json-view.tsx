import { cn } from "../../lib/cn";

/** Read-only, selectable JSON in the code font. */
export function JsonView({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre
      data-selectable
      className={cn(
        "overflow-auto rounded-control bg-surface-sunken p-3 font-mono text-code whitespace-pre text-fg",
        className,
      )}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
