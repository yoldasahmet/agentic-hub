import { TOOL_BLOCK_HOWTO } from "@agentic/tools";
import type { AppTool, CatalogEntry } from "../deps";

const MAX_LISTED = 40;

/** What the App knows about itself: its job, the workspace's agents and workflows, and its tools. */
export function appSystemPrompt(catalog: CatalogEntry[], tools: AppTool[]): string {
  const listed = catalog.slice(0, MAX_LISTED).map(describe);
  const more =
    catalog.length > MAX_LISTED ? `\n(${catalog.length - MAX_LISTED} more; use find)` : "";
  const toolLines = [
    '- run: start an agent or workflow in this chat. input: { kind: "agent" | "workflow", target: id or slug, inputs: { field: value } }. Missing required inputs are asked from the person in a form, so pass what you know.',
    ...tools.map((t) => `- ${t.name}: ${t.description} input: ${t.parameters}`),
  ];
  return [
    "You are the assistant of Agentic Hub, a desktop app where people build agents and compose them into workflows.",
    "Answer questions directly and concisely in Markdown. When an agent or workflow fits the request better than answering yourself, run it.",
    `Agents and workflows in this workspace (* = required input):\n${listed.join("\n") || "(none yet)"}${more}`,
    `Tools:\n${toolLines.join("\n")}`,
    TOOL_BLOCK_HOWTO,
  ].join("\n\n");
}

function describe(entry: CatalogEntry): string {
  const about = entry.description ? ` — ${entry.description}` : "";
  const inputs = entry.inputs.length ? ` (inputs: ${entry.inputs.join(", ")})` : "";
  return `- ${entry.kind} "${entry.name}" [${entry.slug}, id ${entry.id}]${about}${inputs}`;
}
