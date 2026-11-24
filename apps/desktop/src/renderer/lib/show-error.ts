import { AppError } from "@agentic/contracts";
import { toast } from "@agentic/ui";
import { openDatabaseSettings, openLogs } from "./navigate";

/** A next step for codes where the fix lives somewhere specific. */
const hints: Record<string, { description: string; label: string; run: () => void }> = {
  unavailable: {
    description: "Core or the database isn't reachable right now.",
    label: "Database",
    run: () => openDatabaseSettings(),
  },
};

/**
 * The app's error toast: the message, a hint when the code has one, and a
 * link to the logs (filtered to the failing request when Core sent a trace id).
 */
export function showError(err: unknown, fallback = "Something went wrong"): void {
  const error = AppError.from(err);
  const message = error.message || fallback;
  const hint = hints[error.code];
  const viewLogs = {
    label: "View logs",
    onClick: () => openLogs(error.traceId ? { traceId: error.traceId } : { level: "warn" }),
  };
  toast.error(message, {
    description: hint?.description,
    action: hint ? { label: hint.label, onClick: hint.run } : viewLogs,
    cancel: hint ? viewLogs : undefined,
  });
}
