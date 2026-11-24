import { AppError } from "@agentic/contracts";
import { invoke } from "./bridge";

/**
 * Sends a renderer error to main's log (module `renderer`). Never throws:
 * reporting must not cause a second error.
 */
export function reportError(err: unknown, context: Record<string, unknown> = {}): void {
  const error = AppError.from(err);
  const stack = err instanceof Error ? err.stack : undefined;
  void invoke("logs.write", {
    level: "error",
    msg: error.message.slice(0, 2000) || "Renderer error",
    data: { code: error.code, traceId: error.traceId, stack, ...context },
  }).catch(() => undefined);
}

/** Uncaught errors and rejections outside React (event handlers, timers, promises). */
export function installErrorReporting(): void {
  window.addEventListener("error", (event) =>
    reportError(event.error ?? event.message, { source: "window.error" }),
  );
  window.addEventListener("unhandledrejection", (event) =>
    reportError(event.reason, { source: "unhandledrejection" }),
  );
}
