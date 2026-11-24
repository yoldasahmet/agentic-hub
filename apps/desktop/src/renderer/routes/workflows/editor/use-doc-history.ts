import type { WorkflowDocument } from "@agentic/contracts";
import { useCallback, useRef, useState } from "react";

const LIMIT = 100;
const COALESCE_MS = 800;

/**
 * Undo/redo for document edits. Edits in the same `group` within a short
 * pause (typing in one field) become one step.
 */
export function useDocHistory(initial: WorkflowDocument) {
  const [doc, setDoc] = useState(initial);
  const past = useRef<WorkflowDocument[]>([]);
  const future = useRef<WorkflowDocument[]>([]);
  const last = useRef<{ group?: string; at: number }>({ at: 0 });
  const current = useRef(doc);
  current.current = doc;
  const [, setTick] = useState(0);

  const push = useCallback((next: WorkflowDocument, group?: string) => {
    const now = Date.now();
    const coalesce =
      group !== undefined && group === last.current.group && now - last.current.at < COALESCE_MS;
    if (!coalesce) past.current = [...past.current, current.current].slice(-LIMIT);
    future.current = [];
    last.current = { group, at: now };
    setDoc(next);
  }, []);

  const move = (from: typeof past, to: typeof future) => () => {
    const target = from.current.at(-1);
    if (!target) return false;
    from.current = from.current.slice(0, -1);
    to.current = [...to.current, current.current];
    last.current = { at: 0 };
    setDoc(target);
    setTick((t) => t + 1);
    return true;
  };

  const reset = useCallback((next: WorkflowDocument) => {
    past.current = [];
    future.current = [];
    setDoc(next);
  }, []);

  return {
    doc,
    push,
    reset,
    undo: move(past, future),
    redo: move(future, past),
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
