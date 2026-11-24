/** "PR Summarizer!" → "pr-summarizer". Falls back to `fallback` for names with no letters or digits. */
export function slugify(name: string, fallback = "agent"): string {
  const slug = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56)
    .replace(/-+$/, "");
  return slug || fallback;
}

/** `base`, or `base-2`, `base-3`, … whichever is free. */
export function uniqueSlug(base: string, taken: string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
