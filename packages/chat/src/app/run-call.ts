import type { ChatTarget, JsonValue } from "@agentic/contracts";
import type { CatalogEntry } from "../deps";
import { runCallSchema } from "./protocol";

export type RunRequest = {
  target: Exclude<ChatTarget, { kind: "app" }>;
  inputs: Record<string, JsonValue>;
};

/** Finds what a `run` call names (id, slug, or name) among the workspace's published targets. */
export function readRunCall(
  input: Record<string, unknown>,
  catalog: CatalogEntry[],
): { ok: true; run: RunRequest } | { ok: false; issue: string } {
  const parsed = runCallSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issue: "run needs { kind, target, inputs }" };
  }
  const { kind, target, inputs } = parsed.data;
  const wanted = target.trim().toLowerCase();
  const entry = catalog.find(
    (e) =>
      e.kind === kind && (e.id === target || e.slug === wanted || e.name.toLowerCase() === wanted),
  );
  if (!entry) return { ok: false, issue: `No published ${kind} matches "${target}"; use find` };
  return { ok: true, run: { target: { kind, id: entry.id }, inputs } };
}
