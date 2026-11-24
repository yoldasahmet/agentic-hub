import { stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { PickedFile } from "@agentic/contracts";
import { BrowserWindow, dialog } from "electron";

/** Enough to tell text from images when a prompt is built; Core sniffs nothing. */
const MEDIA_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

export const mediaTypeOf = (path: string) =>
  MEDIA_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";

/** Chat attachments: files chosen in the native picker, with their size. */
export async function openFiles(): Promise<PickedFile[]> {
  const window = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = { properties: ["openFile", "multiSelections"] };
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled) return [];
  return Promise.all(
    result.filePaths.map(async (path) => ({
      name: basename(path),
      path,
      mediaType: mediaTypeOf(path),
      size: (await stat(path)).size,
    })),
  );
}

export async function openDirectory(defaultPath?: string): Promise<{ path: string | null }> {
  const window = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    properties: ["openDirectory", "createDirectory"],
    defaultPath,
  };
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  return { path: result.canceled ? null : (result.filePaths[0] ?? null) };
}
