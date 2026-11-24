import { z } from "zod";

export type AdfMark = { type: string; attrs?: Record<string, unknown> };

/** Atlassian Document Format: a tree of typed nodes. Unknown types are kept and degrade to text. */
export type AdfNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: AdfMark[];
  content?: AdfNode[];
};

/** The root Jira expects on writes. */
export type AdfDoc = { version: 1; type: "doc"; content: AdfNode[] };

const markSchema = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export const adfNodeSchema: z.ZodType<AdfNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z.array(markSchema).optional(),
    content: z.array(adfNodeSchema).optional(),
  }),
);

/** A string attribute, or `fallback` when it is missing or not a string. */
export function attr(
  node: { attrs?: Record<string, unknown> },
  name: string,
  fallback = "",
): string {
  const value = node.attrs?.[name];
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}
