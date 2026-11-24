import { templateParts } from "@agentic/contracts";
import { cn } from "../../lib/cn";

/**
 * The template filled with sample inputs, exactly as the runtime renders
 * it. Filled values are tinted; missing ones show their placeholder.
 */
export function TemplatePreview({
  template,
  input,
  className,
}: {
  template: string;
  input: Record<string, unknown>;
  className?: string;
}) {
  const parts = templateParts(template, input);
  if (!template.trim()) {
    return <p className="text-fg-muted">Empty template: the inputs are sent as JSON.</p>;
  }
  return (
    <pre
      data-selectable
      className={cn(
        "whitespace-pre-wrap rounded-control bg-surface-sunken p-3 font-mono text-code",
        className,
      )}
    >
      {parts.map((part, index) =>
        part.kind === "text" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and rebuilt on each render
          <span key={index}>{part.text}</span>
        ) : part.missing ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: as above
          <span key={index} className="rounded bg-warning-tint px-0.5 text-warning-ink">
            {`{{${part.path}}}`}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: as above
          <span key={index} className="rounded bg-accent-tint px-0.5 text-accent-ink">
            {part.text}
          </span>
        ),
      )}
    </pre>
  );
}
