import type { MenuCommand } from "@agentic/contracts";
import { PRODUCT_NAME } from "@agentic/contracts";
import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";
import { installCliFromMenu } from "./cli/install-cli-dialog";
import { sendEvent } from "./ipc/send";
import { checkForUpdatesFromMenu } from "./updater";

function command(label: string, accelerator: string, cmd: MenuCommand): MenuItemConstructorOptions {
  return {
    id: cmd,
    label,
    accelerator,
    click: () => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      if (win) sendEvent(win, "menu.command", cmd);
    },
  };
}

/** The native menu. Shortcuts live here so they work even while a text field has focus. */
export function installAppMenu(): void {
  const isMac = process.platform === "darwin";
  const settings = command("Settings…", "CmdOrCtrl+,", "settings");
  const installCli: MenuItemConstructorOptions = {
    label: "Install Command Line Tool…",
    click: () => void installCliFromMenu(),
  };
  const checkUpdates: MenuItemConstructorOptions = {
    label: "Check for Updates…",
    click: () => void checkForUpdatesFromMenu(),
  };
  const devItems: MenuItemConstructorOptions[] = app.isPackaged
    ? []
    : [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
      ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: PRODUCT_NAME,
            submenu: [
              { role: "about", label: `About ${PRODUCT_NAME}` },
              checkUpdates,
              { type: "separator" },
              settings,
              installCli,
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide", label: `Hide ${PRODUCT_NAME}` },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit", label: `Quit ${PRODUCT_NAME}` },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "File",
      submenu: [
        command("New Chat", "CmdOrCtrl+N", "new-chat"),
        { type: "separator" },
        ...(isMac ? [] : [settings, installCli, { type: "separator" } as const]),
        isMac ? { role: "close" } : { role: "quit", label: `Quit ${PRODUCT_NAME}` },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        command("Command Palette", "CmdOrCtrl+K", "command-palette"),
        { type: "separator" },
        ...devItems,
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
