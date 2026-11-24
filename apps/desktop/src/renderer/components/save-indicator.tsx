import { AlertTriangle, Check, LoaderCircle } from "lucide-react";

/** Where an editor's autosave stands. */
export type SaveState = "saved" | "pending" | "saving" | "invalid" | "error";

/** Autosave status next to the title: always an icon plus words. */
export function SaveIndicator({ state, problem }: { state: SaveState; problem?: string }) {
  if (state === "invalid") {
    return (
      <span className="flex items-center gap-1 text-sm text-warning-ink">
        <AlertTriangle aria-hidden className="size-3.5" /> {problem ?? "Not saved"}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-sm text-danger-ink">
        <AlertTriangle aria-hidden className="size-3.5" /> Not saved
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-sm text-fg-muted">
        <Check aria-hidden className="size-3.5" /> Draft saved
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-sm text-fg-muted">
      <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />{" "}
      Saving…
    </span>
  );
}
