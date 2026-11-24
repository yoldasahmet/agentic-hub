import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_NAME } from "@agentic/contracts";
import { app, BrowserWindow } from "electron";
import { rendererUrl } from "../renderer-url";
import { loadWindowState, trackWindowState } from "./window-state";

// Matches the --canvas token so the window never flashes white before paint.
const CANVAS = "#efede4";

export async function createMainWindow(): Promise<BrowserWindow> {
  const statePath = join(app.getPath("userData"), "window-state.json");
  const state = await loadWindowState(statePath);
  const isMac = process.platform === "darwin";

  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: PRODUCT_NAME,
    backgroundColor: CANVAS,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: { x: 14, y: 12 },
    webPreferences: {
      preload: fileURLToPath(new URL("../preload/index.cjs", import.meta.url)),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  if (state.maximized) win.maximize();
  trackWindowState(win, statePath);
  win.once("ready-to-show", () => win.show());
  await win.loadURL(rendererUrl().href);
  return win;
}
