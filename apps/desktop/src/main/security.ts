import { app, shell } from "electron";
import { isAppUrl } from "./renderer-url";

/**
 * Navigation and permission guards for every web contents. The renderer
 * stays on the app's own page. External https links open in the browser.
 */
export function installSecurityGuards(): void {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-navigate", (event, url) => {
      if (!isAppUrl(url)) event.preventDefault();
    });
    contents.on("will-redirect", (event, url) => {
      if (!isAppUrl(url)) event.preventDefault();
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https://")) void shell.openExternal(url);
      return { action: "deny" };
    });
    // Camera, mic, notifications, etc. are requested by main, never the page.
    contents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    contents.session.setPermissionCheckHandler(() => false);
  });
}
