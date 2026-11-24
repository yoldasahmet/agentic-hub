import type { RunEvent } from "@agentic/contracts";
import { useEffect, useState } from "react";
import { useCore } from "./core";

/**
 * Every event of a run, live. It subscribes first and then loads the
 * persisted events, merging by `seq`, so nothing between the two is lost.
 */
export function useRunEvents(runId: string | undefined): RunEvent[] {
  const core = useCore();
  const [events, setEvents] = useState<RunEvent[]>([]);

  useEffect(() => {
    setEvents([]);
    if (!core || !runId) return;
    const bySeq = new Map<number, RunEvent>();
    let active = true;
    const publish = () => {
      if (active) setEvents([...bySeq.values()].sort((a, b) => a.seq - b.seq));
    };
    const stop = core.socket.subscribeRun(runId, (event) => {
      bySeq.set(event.seq, event);
      publish();
    });
    void (async () => {
      let after = 0;
      for (;;) {
        const page = await core.client.runs.events(runId, after);
        for (const event of page.items) bySeq.set(event.seq, event);
        if (page.items.length === 0 || page.lastSeq === after) break;
        after = page.lastSeq;
      }
      publish();
    })();
    return () => {
      active = false;
      stop();
    };
  }, [core, runId]);

  return events;
}
