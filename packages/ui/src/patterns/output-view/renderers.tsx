import type { OutputFormat } from "@agentic/contracts";
import type { ReactNode } from "react";
import { JsonView } from "../state-inspector/json-view";
import { DiffBlock, looksLikeDiff } from "./diff-block";
import { MarkdownText } from "./markdown-output";
import { PlanSteps, planSteps } from "./plan-steps";
import { RecordTable, recordsOf } from "./record-table";
import { ValueSections } from "./value-sections";

export type OutputRenderer = (props: { value: Record<string, unknown> }) => ReactNode;

const isStringList = (item: unknown): item is string[] =>
  Array.isArray(item) && item.length > 0 && item.every((i) => typeof i === "string");

/** Strings as markdown and string lists as bullets; anything else falls back to JSON. */
const prose = (_key: string, item: unknown) =>
  typeof item === "string" ? (
    <MarkdownText text={item} />
  ) : isStringList(item) ? (
    <MarkdownText text={item.map((i) => `- ${i.replace(/\n/g, " ")}`).join("\n")} />
  ) : null;

/**
 * Output renderers by format (P6.6). Behavior comes from data: an agent's
 * `outputFormat` picks the renderer, never its role. Each renderer shows
 * the values it understands and falls back to prose or JSON for the rest.
 */
export const outputRenderers: Record<OutputFormat, OutputRenderer> = {
  markdown: ({ value }) => <ValueSections value={value} render={prose} />,
  json: ({ value }) => <JsonView value={value} />,
  plan: ({ value }) => (
    <ValueSections
      value={value}
      render={(key, item) => {
        const steps = planSteps(item);
        return steps ? <PlanSteps steps={steps} /> : prose(key, item);
      }}
    />
  ),
  diff: ({ value }) => (
    <ValueSections
      value={value}
      render={(key, item) =>
        typeof item === "string" && looksLikeDiff(item) ? (
          <DiffBlock diff={item} />
        ) : (
          prose(key, item)
        )
      }
    />
  ),
  html: ({ value }) => (
    <ValueSections
      value={value}
      render={(_key, item) =>
        typeof item === "string" ? (
          // No scripts, forms, or same-origin access: the sandbox is empty.
          <iframe
            title="HTML output"
            sandbox=""
            srcDoc={item}
            className="h-96 w-full rounded-control border border-border bg-surface-raised"
          />
        ) : null
      }
    />
  ),
  table: ({ value }) => (
    <ValueSections
      value={value}
      render={(key, item) => {
        const rows = recordsOf(item);
        return rows ? <RecordTable rows={rows} /> : prose(key, item);
      }}
    />
  ),
};
