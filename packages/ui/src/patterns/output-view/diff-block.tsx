import { cn } from "../../lib/cn";

/** A unified diff: has hunk headers or file headers. */
export function looksLikeDiff(text: string): boolean {
  return /^(diff --git |--- |\+\+\+ |@@ )/m.test(text) && /^@@ /m.test(text);
}

const lineClass = (line: string) =>
  line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ")
    ? "font-semibold text-fg"
    : line.startsWith("@@")
      ? "bg-info-tint text-info-ink"
      : line.startsWith("+")
        ? "bg-success-tint text-success-ink"
        : line.startsWith("-")
          ? "bg-danger-tint text-danger-ink"
          : "text-fg-muted";

/** A colored, selectable unified diff. `DiffViewer` (P10.3) adds files and comments. */
export function DiffBlock({ diff }: { diff: string }) {
  return (
    <pre
      data-selectable
      className="overflow-auto rounded-control border border-border bg-surface font-mono text-code"
    >
      {diff.split("\n").map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
        <div key={index} className={cn("px-3", lineClass(line))}>
          {line || " "}
        </div>
      ))}
    </pre>
  );
}
