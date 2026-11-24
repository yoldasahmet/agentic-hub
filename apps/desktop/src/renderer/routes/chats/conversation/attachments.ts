import type { ChatAttachment, PickedFile } from "@agentic/contracts";

export const fileAttachment = (file: PickedFile): ChatAttachment => ({ kind: "file", ...file });

/** Dropped files get their local path from the preload bridge; ones without a path are skipped. */
export function droppedAttachments(files: File[]): ChatAttachment[] {
  return files.flatMap((file) => {
    const path = window.app.pathForFile(file);
    if (!path) return [];
    const mediaType = file.type || "application/octet-stream";
    return [{ kind: "file" as const, name: file.name, path, mediaType, size: file.size }];
  });
}
