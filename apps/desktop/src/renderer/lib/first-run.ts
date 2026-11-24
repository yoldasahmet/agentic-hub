/**
 * Whether first-run setup (P18.6) was finished or skipped on this Mac.
 * Per install, like window state, so it lives in the renderer's storage;
 * blocked storage counts as done rather than showing setup on every launch.
 */
const KEY = "agentic.first-run.done";

export function isFirstRunDone(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markFirstRunDone(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Nothing to remember it in; setup simply shows again.
  }
}
