/** `KEY=value` lines ↔ a record, for env variables and headers in the server form. */
export function parsePairs(text: string, separator = "="): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const at = line.indexOf(separator);
    if (at <= 0) continue;
    out[line.slice(0, at).trim()] = line.slice(at + separator.length).trim();
  }
  return out;
}

export function formatPairs(record: Record<string, string>, separator = "="): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}${separator}${value}`)
    .join("\n");
}
