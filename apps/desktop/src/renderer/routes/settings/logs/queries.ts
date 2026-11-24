import type { LogQuery } from "@agentic/contracts";
import { toast } from "@agentic/ui";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { invoke } from "../../../lib/bridge";
import { showError } from "../../../lib/show-error";

/** Main reads the files, so logs stay readable while Core is down. */
export function useLogs(query: LogQuery, live: boolean) {
  return useQuery({
    queryKey: ["logs", query],
    queryFn: () => invoke("logs.query", query),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 2_000 : false,
    staleTime: 0,
  });
}

export function useCopyDiagnostics() {
  return useMutation({
    mutationFn: () => invoke("logs.copyDiagnostics", undefined),
    onSuccess: ({ entries }) =>
      toast.success("Diagnostics copied", {
        description: `Versions, status, and ${entries} recent log lines, with secrets removed.`,
      }),
    onError: (err) => showError(err),
  });
}

export const openLogFolder = () => invoke("logs.openFolder", undefined);
