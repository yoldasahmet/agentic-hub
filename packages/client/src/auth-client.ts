import {
  type AuthSettingsInput,
  authSessionSchema,
  authStatusSchema,
  type SignInInput,
  type SignUpInput,
  type WorkspaceRole,
  workspaceMemberSchema,
} from "@agentic/contracts";
import type { AppType } from "@agentic/core";
import type { hc } from "hono/client";
import { z } from "zod";
import { parseResponse } from "./response";

type Api = ReturnType<typeof hc<AppType>>;

const okSchema = z.object({ ok: z.literal(true) });

/** Accounts, sessions, and workspace members (`/auth`). */
export function createAuthClient(api: Api) {
  const member = api.auth.members[":userId"];
  return {
    status: async () => parseResponse(await api.auth.status.$get(), authStatusSchema),
    signUp: async (json: SignUpInput) =>
      parseResponse(await api.auth["sign-up"].$post({ json }), authSessionSchema),
    signIn: async (json: SignInInput) =>
      parseResponse(await api.auth["sign-in"].$post({ json }), authSessionSchema),
    signOut: async () => parseResponse(await api.auth["sign-out"].$post(), okSchema),
    members: async () =>
      parseResponse(await api.auth.members.$get(), z.array(workspaceMemberSchema)),
    setRole: async (userId: string, role: WorkspaceRole) =>
      parseResponse(await member.$put({ param: { userId }, json: { role } }), okSchema),
    removeMember: async (userId: string) =>
      parseResponse(await member.$delete({ param: { userId } }), okSchema),
    setSettings: async (json: AuthSettingsInput) =>
      parseResponse(await api.auth.settings.$put({ json }), okSchema),
  };
}
