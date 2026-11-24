import { nodeOfStep, type PendingInterrupt } from "@agentic/contracts";
import { useEffect, useRef } from "react";
import { invoke } from "../lib/bridge";
import { useCoreQuery } from "../lib/core-queries";

/**
 * Keeps the dock badge at the number of waiting gates, and asks main to
 * notify when a gate appears that wasn't there before (not on first load).
 * Returns the count for the sidebar.
 */
export function useInboxAttention(): number {
  const pending = useCoreQuery(["inbox"], (c) => c.inbox()).data;
  const seen = useRef<Set<string> | undefined>(undefined);
  const count = pending?.reduce((n, p) => n + Math.max(1, p.interrupts.length), 0) ?? 0;

  useEffect(() => {
    if (!pending) return;
    const ids = new Set(pending.flatMap((p) => p.interrupts.map((i) => i.id)));
    const fresh = seen.current
      ? pending.find((p) => p.interrupts.some((i) => !seen.current?.has(i.id)))
      : undefined;
    seen.current = ids;
    void invoke("app.attention", {
      pending: count,
      notify: fresh ? describe(fresh) : undefined,
    }).catch(() => undefined);
  }, [pending, count]);

  return count;
}

function describe({ interrupts }: PendingInterrupt) {
  const first = interrupts[0];
  const value = first?.value;
  const title =
    value && typeof value === "object" && "title" in value && typeof value.title === "string"
      ? value.title
      : "A run needs your input";
  return {
    title,
    body: first ? `Waiting at ${nodeOfStep(first.node)}` : "Open the Inbox to answer it.",
  };
}
