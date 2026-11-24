import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/cn";

/** Markdown in the assistant serif. Raw HTML is never rendered (react-markdown's default). */
export function MarkdownText({ text, className }: { text: string; className?: string }) {
  return (
    <div
      data-selectable
      className={cn(
        "grid gap-3 font-serif text-prose text-fg",
        "[&_a]:text-accent-ink [&_a]:underline [&_code]:rounded [&_code]:bg-surface-sunken [&_code]:px-1 [&_code]:font-mono [&_code]:text-code",
        "[&_h1]:text-xl [&_h2]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-surface-sunken [&_pre]:p-3 [&_table]:text-base [&_td]:border [&_td]:border-border [&_td]:px-2 [&_th]:border [&_th]:border-border [&_th]:px-2",
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
}
