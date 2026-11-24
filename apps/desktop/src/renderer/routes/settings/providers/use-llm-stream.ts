import { AppError, type LlmCallInput, type LlmCallResult } from "@agentic/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCore } from "../../../lib/core";

export type StreamState = {
  running: boolean;
  text: string;
  thinking: string;
  toolCalls: number;
  result?: LlmCallResult;
  error?: string;
};

const idle: StreamState = { running: false, text: "", thinking: "", toolCalls: 0 };

/** Streams one call from Core into React state. Cancel (or unmount) aborts it in Core. */
export function useLlmStream() {
  const core = useCore();
  const [state, setState] = useState<StreamState>(idle);
  const abort = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => abort.current?.abort(), []);

  const start = useCallback(
    async (input: LlmCallInput) => {
      if (!core) return;
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setState({ ...idle, running: true });
      try {
        const result = await core.client.llm.stream(
          input,
          (event) =>
            setState((s) => {
              if (event.type === "text") return { ...s, text: s.text + event.delta };
              if (event.type === "thinking") return { ...s, thinking: s.thinking + event.delta };
              if (event.type === "tool_call") return { ...s, toolCalls: s.toolCalls + 1 };
              return s;
            }),
          controller.signal,
        );
        setState((s) => ({ ...s, running: false, result, error: result.error?.message }));
      } catch (err) {
        const message = controller.signal.aborted ? "Cancelled" : AppError.from(err).message;
        setState((s) => ({ ...s, running: false, error: message }));
      }
    },
    [core],
  );

  const cancel = useCallback(() => abort.current?.abort(), []);
  return { state, start, cancel };
}
