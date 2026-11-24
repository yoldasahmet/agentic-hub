import type { ITheme } from "@xterm/xterm";

/** xterm takes colors as strings, so they are read from the design tokens at mount. */
export function terminalTheme(): ITheme {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim() || undefined;
  return {
    background: token("--surface"),
    foreground: token("--text"),
    cursor: token("--accent"),
    selectionBackground: token("--accent-tint"),
    black: token("--text"),
    red: token("--danger"),
    green: token("--success"),
    yellow: token("--warning"),
    blue: token("--info"),
    brightBlack: token("--text-subtle"),
  };
}
