import { type OutputFormat, schemaToFields } from "@agentic/contracts";
import { outputRenderers } from "./renderers";

export type OutputViewProps = {
  format: OutputFormat;
  value: Record<string, unknown>;
  /** The output schema: fields show in its order, whatever order the model answered in. */
  schema?: unknown;
};

/** Shows an agent's output with the renderer for its format. */
export function OutputView({ format, value, schema }: OutputViewProps) {
  const Renderer = outputRenderers[format];
  return <Renderer value={ordered(value, schema)} />;
}

function ordered(value: Record<string, unknown>, schema: unknown): Record<string, unknown> {
  const order = schemaToFields(schema).map((f) => f.name);
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => rank(a) - rank(b)));
}
