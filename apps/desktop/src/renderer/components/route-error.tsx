import { AppError } from "@agentic/contracts";
import { Button } from "@agentic/ui";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { invoke } from "../lib/bridge";
import { openLogs } from "../lib/navigate";
import { reportError } from "../lib/report-error";
import { showError } from "../lib/show-error";

/**
 * Shown in place of a page (or the whole shell) that threw while rendering
 * or loading. The error goes to the log; the user can retry, read the
 * logs, or copy a diagnostics bundle for a bug report.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const appError = AppError.from(error);
  useEffect(() => reportError(error, { source: "route" }), [error]);

  const retry = () => {
    reset();
    void router.invalidate();
  };
  const copy = () =>
    invoke("logs.copyDiagnostics", undefined).then(
      () => undefined,
      (err: unknown) => showError(err),
    );

  return (
    <div role="alert" className="mx-auto grid max-w-lg gap-4 px-8 py-16">
      <div className="flex items-center gap-2 text-danger-ink">
        <TriangleAlert aria-hidden className="size-5" />
        <h2 className="font-serif text-xl">This page hit an error</h2>
      </div>
      <p className="text-fg">{appError.message || "Something went wrong."}</p>
      <p className="text-fg-muted">
        It has been written to the log. Try again, or copy the diagnostics for a bug report.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={retry}>
          Try again
        </Button>
        <Button variant="secondary" onClick={() => openLogs({ level: "warn" })}>
          View logs
        </Button>
        <Button variant="ghost" onClick={() => void copy()}>
          Copy diagnostics
        </Button>
      </div>
    </div>
  );
}
