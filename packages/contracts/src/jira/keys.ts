/** Issue keys like ABC-123 in free text (branch names, PR titles and bodies). */
const KEY = /(?<![A-Za-z0-9])([A-Z][A-Z0-9_]{1,9}-[1-9]\d{0,6})(?![A-Za-z0-9])/g;

/** Distinct Jira keys in the order they appear, case-sensitive (so `utf-8` isn't one). */
export function jiraKeysIn(...texts: Array<string | null | undefined>): string[] {
  const keys = new Set<string>();
  for (const text of texts) {
    for (const m of (text ?? "").matchAll(KEY)) if (m[1]) keys.add(m[1]);
  }
  return [...keys];
}

/** Keys at the start of a branch name, in any case: `abc-12-fix` and `feature/ABC-12` → ABC-12. */
export function jiraKeysInBranch(branch: string): string[] {
  const last = branch.split("/").pop() ?? "";
  const m = /^([A-Za-z][A-Za-z0-9_]{1,9}-[1-9]\d{0,6})(?![0-9])/.exec(last);
  return m?.[1] ? [m[1].toUpperCase()] : [];
}
