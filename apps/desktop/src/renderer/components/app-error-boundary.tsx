import { Button } from "@agentic/ui";
import { Component, type ReactNode } from "react";
import { reportError } from "../lib/report-error";

type State = { error: Error | undefined };

/**
 * The last line of defense, around the router: if the shell itself fails,
 * the error is logged and the window offers a reload instead of going blank.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    reportError(error, { source: "app-boundary" });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="grid h-full place-content-center gap-3 bg-canvas p-8 text-center"
      >
        <h1 className="font-serif text-xl">The app hit an unexpected error</h1>
        <p className="max-w-md text-fg-muted">{this.state.error.message}</p>
        <p className="text-fg-muted">It has been written to the log.</p>
        <div>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
