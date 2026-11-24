import { pathToFileURL } from "node:url";
import { app } from "electron";

/** Where the renderer is served from: the Vite dev server in dev, bundled files otherwise. */
export function rendererUrl(): URL {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devUrl) return new URL(devUrl);
  return pathToFileURL(new URL("../renderer/index.html", import.meta.url).pathname);
}

/** True when `url` belongs to our renderer. Used for navigation and IPC sender checks. */
export function isAppUrl(url: string): boolean {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  const app = rendererUrl();
  if (app.protocol === "file:") {
    return target.protocol === "file:" && target.pathname === app.pathname;
  }
  return target.origin === app.origin;
}
