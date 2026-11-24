import { BrowserWindow, dialog, type MessageBoxOptions } from "electron";
import { installCli } from "./install-cli";

async function show(options: MessageBoxOptions): Promise<void> {
  const window = BrowserWindow.getFocusedWindow();
  if (window) await dialog.showMessageBox(window, options);
  else await dialog.showMessageBox(options);
}

/** "Install Command Line Tool…": installs, then says where and what to do next. */
export async function installCliFromMenu(): Promise<void> {
  try {
    const { link, onPath } = await installCli();
    const pathHint = onPath
      ? "Open a new terminal and run `agentic doctor`."
      : `Add ${link.replace(/\/agentic$/, "")} to your PATH, then run \`agentic doctor\`.`;
    await show({
      type: "info",
      message: "The agentic command is installed",
      // The packaged CLI runs on the user's Node (the RunAsNode fuse is off).
      detail: `${link}\n\n${pathHint} It needs Node.js 22 or later.`,
    });
  } catch (err) {
    await show({
      type: "error",
      message: "Couldn't install the agentic command",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
