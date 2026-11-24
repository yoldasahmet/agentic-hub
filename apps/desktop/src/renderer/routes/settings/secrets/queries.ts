import type { SecretName } from "@agentic/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "../../../lib/bridge";

const keys = {
  status: ["secrets", "status"] as const,
  list: ["secrets", "list"] as const,
};

export function useVaultStatus() {
  return useQuery({ queryKey: keys.status, queryFn: () => invoke("secrets.status", undefined) });
}

export function useSecrets() {
  return useQuery({ queryKey: keys.list, queryFn: () => invoke("secrets.list", undefined) });
}

export function useSetSecret() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: SecretName; value: string }) => invoke("secrets.set", input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.list }),
  });
}

export function useDeleteSecret() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: SecretName) => invoke("secrets.delete", { name }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.list }),
  });
}
