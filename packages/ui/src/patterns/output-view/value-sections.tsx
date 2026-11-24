import type { ReactNode } from "react";
import { JsonView } from "../state-inspector/json-view";

/**
 * Renders an output object field by field: `render` handles the values it
 * understands (returns null otherwise), and everything else falls back to
 * a JSON view. Free-text outputs (`{ text }`) show without a heading.
 */
export function ValueSections({
  value,
  render,
}: {
  value: Record<string, unknown>;
  render: (key: string, value: unknown) => ReactNode | null;
}) {
  const entries = Object.entries(value);
  if (entries.length === 1 && entries[0]?.[0] === "text") {
    return render("text", entries[0][1]) ?? <JsonView value={entries[0][1]} />;
  }
  return (
    <div className="grid gap-4">
      {entries.map(([key, item]) => (
        <section key={key} className="grid gap-1.5">
          <h3 className="font-mono text-code text-fg-muted">{key}</h3>
          {render(key, item) ?? <JsonView value={item} />}
        </section>
      ))}
    </div>
  );
}
