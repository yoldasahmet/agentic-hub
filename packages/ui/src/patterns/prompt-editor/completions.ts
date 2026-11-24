/** The `{{ input.<partial>` being typed just before the caret, if any. */
const OPEN = /\{\{\s*(?:input\.?)?([A-Za-z0-9_]*)$/;

export type Completion = { from: number; query: string };

export function completionAt(text: string, caret: number): Completion | undefined {
  const match = OPEN.exec(text.slice(0, caret));
  if (!match) return undefined;
  return { from: match.index, query: match[1] ?? "" };
}

/** Replaces the open placeholder with `{{input.<field>}}`, closing it if needed. Returns the new caret. */
export function applyCompletion(
  text: string,
  caret: number,
  completion: Completion,
  field: string,
): { text: string; caret: number } {
  const after = text.slice(caret).replace(/^[A-Za-z0-9_]*\s*\}\}/, "");
  const insert = `{{input.${field}}}`;
  return {
    text: text.slice(0, completion.from) + insert + after,
    caret: completion.from + insert.length,
  };
}
