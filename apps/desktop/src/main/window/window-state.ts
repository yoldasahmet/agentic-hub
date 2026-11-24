import { readFile, writeFile } from "node:fs/promises";
import { type BrowserWindow, type Rectangle, screen } from "electron";
import { z } from "zod";

const windowStateSchema = z.object({
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  width: z.number().int().min(400),
  height: z.number().int().min(300),
  maximized: z.boolean(),
});
export type WindowState = z.infer<typeof windowStateSchema>;

const DEFAULT_STATE: WindowState = { width: 1280, height: 820, maximized: false };

/** Loads the saved bounds, dropping the position if that display is gone. */
export async function loadWindowState(path: string): Promise<WindowState> {
  try {
    const state = windowStateSchema.parse(JSON.parse(await readFile(path, "utf8")));
    if (state.x === undefined || state.y === undefined) return state;
    const bounds: Rectangle = { x: state.x, y: state.y, width: state.width, height: state.height };
    return isOnScreen(bounds) ? state : { ...state, x: undefined, y: undefined };
  } catch {
    return DEFAULT_STATE;
  }
}

/** Saves bounds on move/resize (debounced) and on close. */
export function trackWindowState(win: BrowserWindow, path: string): void {
  let timer: NodeJS.Timeout | undefined;
  const save = () => {
    if (win.isDestroyed()) return;
    const { x, y, width, height } = win.getNormalBounds();
    const state: WindowState = { x, y, width, height, maximized: win.isMaximized() };
    void writeFile(path, JSON.stringify(state)).catch(() => undefined);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(save, 400);
  };
  win.on("resize", schedule);
  win.on("move", schedule);
  win.on("maximize", schedule);
  win.on("unmaximize", schedule);
  win.on("close", () => {
    clearTimeout(timer);
    save();
  });
}

function isOnScreen(bounds: Rectangle): boolean {
  const area = screen.getDisplayMatching(bounds).workArea;
  return (
    bounds.x < area.x + area.width &&
    bounds.x + bounds.width > area.x &&
    bounds.y < area.y + area.height &&
    bounds.y + bounds.height > area.y
  );
}
