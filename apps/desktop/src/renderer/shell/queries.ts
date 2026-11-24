import type { CoreStatus, DatabaseStatus } from "@agentic/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { invoke, onEvent } from "../lib/bridge";

export const databaseStatusKey = ["database", "status"] as const;
export const coreStatusKey = ["core-status"] as const;

export function useAppInfo() {
  return useQuery({ queryKey: ["app", "info"], queryFn: () => invoke("app.info", undefined) });
}

export function useDatabaseStatus() {
  return useQuery({
    queryKey: databaseStatusKey,
    queryFn: () => invoke("database.status", undefined),
  });
}

/** Mounted once in the shell: main pushes every DB status change into the query cache. */
export function useDatabaseStatusEvents() {
  const client = useQueryClient();
  useEffect(
    () =>
      onEvent("database.status", (status: DatabaseStatus) =>
        client.setQueryData(databaseStatusKey, status),
      ),
    [client],
  );
}

export function useCoreStatus() {
  return useQuery({ queryKey: coreStatusKey, queryFn: () => invoke("core.status", undefined) });
}

/** Mounted once in the shell: Core's address and state follow main's supervisor. */
export function useCoreStatusEvents() {
  const client = useQueryClient();
  useEffect(
    () =>
      onEvent("core.status", (status: CoreStatus) => client.setQueryData(coreStatusKey, status)),
    [client],
  );
}
