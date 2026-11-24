/** A branch name for an issue: `ABC-123-short-summary`, so the PR links back on its own. */
export function branchFor(key: string, summary: string): string {
  const slug = summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug ? `${key}-${slug}` : key;
}
