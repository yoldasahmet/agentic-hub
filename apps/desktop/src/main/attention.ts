import { app, BrowserWindow, Notification } from "electron";

type Attention = { pending: number; notify?: { title: string; body: string } };

/**
 * Shows how many gates wait for the user on the dock badge, and posts a
 * native notification for a new one while the window isn't focused.
 * Clicking it brings the window back.
 */
export function showAttention({ pending, notify }: Attention): { ok: boolean } {
  app.setBadgeCount(pending);
  const win = BrowserWindow.getAllWindows()[0];
  if (!notify || win?.isFocused() || !Notification.isSupported()) return { ok: true };
  const note = new Notification({ title: notify.title, body: notify.body });
  note.on("click", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  note.show();
  app.dock?.bounce("informational");
  return { ok: true };
}
