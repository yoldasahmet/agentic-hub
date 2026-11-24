import type { CoreClient } from "@agentic/client";
import { AppError } from "@agentic/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useCore } from "./core";

/** A TanStack query against Core. Disabled until Core is ready; keyed by Core's address. */
export function useCoreQuery<T>(
  key: readonly unknown[],
  fn: (client: CoreClient) => Promise<T>,
  enabled = true,
) {
  const core = useCore();
  return useQuery({
    queryKey: ["core", core?.key, ...key],
    queryFn: () => {
      if (!core) throw new AppError("unavailable", "Core is not ready");
      return fn(core.client);
    },
    enabled: core !== undefined && enabled,
  });
}

/** A mutation against Core that refreshes every Core query when it succeeds. */
export function useCoreMutation<I, T>(fn: (client: CoreClient, input: I) => Promise<T>) {
  const core = useCore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: I) => {
      if (!core) throw new AppError("unavailable", "Core is not ready");
      return fn(core.client, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["core", core?.key] }),
  });
}

/** Refreshes Core views on each live event of a run (checkpoints land as nodes finish). */
export function useRunEventsRefresh(runId: string | undefined) {
  const core = useCore();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!core || !runId) return;
    return core.socket.subscribeRun(runId, () =>
      queryClient.invalidateQueries({ queryKey: ["core", core.key] }),
    );
  }, [core, runId, queryClient]);
}
