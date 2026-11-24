/**
 * Prompt templates: `{{input.field}}` (or a nested path like
 * `{{input.plan.steps}}`) and `{{input}}` for all inputs. Strings are
 * inserted as-is, other values as JSON, and missing values as nothing.
 * Shared by the runtime and the editor's live preview, so they never differ.
 */
const PLACEHOLDER = /\{\{\s*(input(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;

export type TemplatePart =
  | { kind: "text"; text: string }
  | { kind: "value"; path: string; text: string; missing: boolean };

export function renderTemplate(template: string, input: Record<string, unknown>): string {
  return templateParts(template, input)
    .map((part) => part.text)
    .join("");
}

/** The template split into literal text and filled placeholders (the preview highlights them). */
export function templateParts(template: string, input: Record<string, unknown>): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", text: template.slice(last, index) });
    const path = match[1] ?? "input";
    const value = lookup(input, path.split(".").slice(1));
    parts.push({ kind: "value", path, text: stringify(value), missing: value === undefined });
    last = index + match[0].length;
  }
  if (last < template.length) parts.push({ kind: "text", text: template.slice(last) });
  return parts;
}

/** Field names a template refers to (`{{input.a.b}}` → `a`). */
export function templateFields(template: string): string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER)) {
    const field = (match[1] ?? "").split(".")[1];
    if (field) names.add(field);
  }
  return [...names];
}

function lookup(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = Object.entries(current).find(([k]) => k === key)?.[1];
  }
  return current;
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}
