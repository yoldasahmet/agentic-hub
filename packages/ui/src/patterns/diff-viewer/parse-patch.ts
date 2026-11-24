export type DiffLine = {
  kind: "context" | "add" | "del" | "hunk";
  text: string;
  oldNo: number | null;
  newNo: number | null;
};

/** One file of a diff, shaped like a GitHub pull request file. */
export type DiffFile = {
  filename: string;
  previousFilename?: string | null;
  status: string;
  additions: number;
  deletions: number;
  /** Hunks only; null for binary or oversized files. */
  patch: string | null;
};

/** Hunks → numbered lines (ported from the reference `parsePatch`). */
export function parsePatch(patch: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (m) {
        oldNo = Number(m[1]);
        newNo = Number(m[2]);
      }
      out.push({ kind: "hunk", text: raw, oldNo: null, newNo: null });
    } else if (raw.startsWith("+")) {
      out.push({ kind: "add", text: raw.slice(1), oldNo: null, newNo: newNo++ });
    } else if (raw.startsWith("-")) {
      out.push({ kind: "del", text: raw.slice(1), oldNo: oldNo++, newNo: null });
    } else if (raw.startsWith("\\")) {
      out.push({ kind: "hunk", text: raw, oldNo: null, newNo: null });
    } else if (raw !== "" || out.length === 0) {
      out.push({ kind: "context", text: raw.slice(1), oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return out;
}

/** A `git diff` text → files, so local changes render like a pull request. */
export function splitUnifiedDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  for (const chunk of text.split(/^diff --git /m).slice(1)) {
    const lines = chunk.split("\n");
    const header = /^a\/(.+) b\/(.+)$/.exec(lines[0] ?? "");
    const hunkAt = lines.findIndex((l) => l.startsWith("@@"));
    const meta = lines.slice(1, hunkAt === -1 ? undefined : hunkAt);
    const patch = hunkAt === -1 ? null : lines.slice(hunkAt).join("\n").replace(/\n$/, "");
    const body = patch ? patch.split("\n") : [];
    const status = meta.some((l) => l.startsWith("new file"))
      ? "added"
      : meta.some((l) => l.startsWith("deleted file"))
        ? "removed"
        : meta.some((l) => l.startsWith("rename from"))
          ? "renamed"
          : "modified";
    files.push({
      filename: header?.[2] ?? lines[0] ?? "",
      previousFilename: header && header[1] !== header[2] ? header[1] : null,
      status,
      additions: body.filter((l) => l.startsWith("+")).length,
      deletions: body.filter((l) => l.startsWith("-")).length,
      patch,
    });
  }
  return files;
}
