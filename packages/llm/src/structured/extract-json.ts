/**
 * Finds the JSON value in a model's free-text answer: the whole text, then
 * fenced ```json blocks, then the first balanced object or array.
 * Returns undefined when nothing parses.
 */
export function extractJson(text: string): { value: unknown } | undefined {
  const candidates = [text.trim()];
  for (const match of text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)) {
    if (match[1]) candidates.push(match[1].trim());
  }
  const balanced = firstBalanced(text);
  if (balanced) candidates.push(balanced);
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return { value: JSON.parse(candidate) };
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

function firstBalanced(text: string): string | undefined {
  const start = text.search(/[[{]/);
  if (start < 0) return undefined;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return undefined;
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}
