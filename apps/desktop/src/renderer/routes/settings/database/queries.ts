import type { DatabaseTargetInput } from "@agentic/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "../../../lib/bridge";
import { databaseStatusKey } from "../../../shell/queries";

export function useTestDatabase() {
  return useMutation({
    mutationFn: (target: DatabaseTargetInput) => invoke("database.test", target),
  });
}

export function useSwitchDatabase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (target: DatabaseTargetInput) => invoke("database.switch", target),
    onSuccess: (status) => client.setQueryData(databaseStatusKey, status),
  });
}

export function useMigrateDatabase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => invoke("database.migrate", undefined),
    onSuccess: (status) => client.setQueryData(databaseStatusKey, status),
  });
}

export function useBackupDatabase() {
  return useMutation({ mutationFn: () => invoke("database.backup", undefined) });
}

export function useRestoreDatabase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => invoke("database.restore", undefined),
    // A restored cluster has other agents, chats, and runs: refetch everything.
    onSuccess: ({ restored, status }) => {
      client.setQueryData(databaseStatusKey, status);
      if (restored) void client.invalidateQueries();
    },
  });
}
