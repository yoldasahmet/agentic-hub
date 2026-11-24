import { AppError, type Run } from "@agentic/contracts";
import type { Session } from "./connect";
import { exitCodeFor, followRun, printResumeHint } from "./follow";
import { dim, print, printJson } from "./output";

/** Flags shared by `agents run` and `workflows run`. */
export const runOptions = {
  input: { type: "string", multiple: true, short: "i" },
  "input-json": { type: "string" },
  version: { type: "string" },
  detach: { type: "boolean", short: "d" },
} as const;

/** An agent or workflow by id or slug (what people type), among the active ones. */
export function findByRef<T extends { id: string; slug: string }>(
  items: T[],
  ref: string,
  what: string,
): T {
  const found = items.find((item) => item.id === ref || item.slug === ref);
  if (!found)
    throw new AppError("not_found", `No ${what} "${ref}". Try \`agentic ${what}s list\`.`);
  return found;
}

/**
 * Starts a run, then follows it until it ends or waits at a gate. With
 * `--detach` it only prints the run (id, or the full run with `--json`).
 */
export async function launch(
  session: Session,
  start: () => Promise<Run>,
  flags: { json?: boolean; detach?: boolean },
): Promise<number> {
  const run = await start();
  if (flags.detach) {
    if (flags.json) printJson(run);
    else print(run.id);
    return 0;
  }
  if (!flags.json) print(dim(`run ${run.id} · thread ${run.threadId}`));
  const final = await followRun(session, run.id, { stopOnWaiting: true, json: !!flags.json });
  if (!flags.json) printResumeHint(final);
  return exitCodeFor(final.status);
}
