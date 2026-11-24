import type { AuthSettingsInput, WorkspaceRole } from "@agentic/contracts";
import { useCoreMutation, useCoreQuery } from "../../../lib/core-queries";

export function useMembers() {
  return useCoreQuery(["auth", "members"], (c) => c.auth.members());
}

export function useSetRole() {
  return useCoreMutation((c, input: { userId: string; role: WorkspaceRole }) =>
    c.auth.setRole(input.userId, input.role),
  );
}

export function useRemoveMember() {
  return useCoreMutation((c, userId: string) => c.auth.removeMember(userId));
}

export function useSetAuthSettings() {
  return useCoreMutation((c, input: AuthSettingsInput) => c.auth.setSettings(input));
}
