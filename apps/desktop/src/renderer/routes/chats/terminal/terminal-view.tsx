import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { useCore } from "../../../lib/core";
import { terminalTheme } from "./terminal-theme";

/**
 * A terminal-mode session: Core's PTY drawn by xterm. Keystrokes go to the
 * process as typed; the view refits to its pane and tells the PTY its size.
 */
export function TerminalView({ terminalId }: { terminalId: string }) {
  const core = useCore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!core || !host) return;
    const term = new Terminal({
      fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
      fontSize: 12.5,
      cursorBlink: true,
      theme: terminalTheme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    const detach = core.socket.attachTerminal(terminalId, {
      data: (chunk) => term.write(chunk),
      exit: (code) => term.write(`\r\n\x1b[2m[exited with code ${code}]\x1b[0m\r\n`),
      reattach: () => term.reset(),
    });
    const input = term.onData((data) => core.socket.writeTerminal(terminalId, data));
    const resize = () => {
      if (host.clientWidth === 0) return;
      fit.fit();
      core.socket.resizeTerminal(terminalId, term.cols, term.rows);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    term.focus();
    return () => {
      observer.disconnect();
      input.dispose();
      detach();
      term.dispose();
    };
  }, [core, terminalId]);

  return <div ref={ref} className="h-full min-h-0 w-full bg-surface p-2" data-testid="terminal" />;
}
