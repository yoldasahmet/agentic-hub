import { z } from "zod";
import type { SecretName } from "../secrets";

/** Vault entries the GitHub integration reads. Main hands them to Core like provider keys. */
export const GITHUB_SECRETS = {
  token: "github.token",
} as const satisfies Record<string, SecretName>;

/** Where the token in use came from: the vault (PAT or device flow) or `gh auth token`. */
export const githubTokenSourceSchema = z.enum(["vault", "gh", "none"]);
export type GithubTokenSource = z.infer<typeof githubTokenSourceSchema>;

export const githubAuthStatusSchema = z.object({
  source: githubTokenSourceSchema,
  /** Null when there is no token or GitHub refused it. */
  login: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /** OAuth scopes of classic tokens; fine-grained tokens report none. */
  scopes: z.array(z.string()),
  /** `gh` is installed and signed in, even if the vault token wins. */
  ghAvailable: z.boolean(),
  deviceFlowAvailable: z.boolean(),
  error: z.string().nullable(),
});
export type GithubAuthStatus = z.infer<typeof githubAuthStatusSchema>;

/** Non-secret workspace settings. The OAuth app's client id is public by design. */
export const githubSettingsSchema = z.object({
  oauthClientId: z.string().trim().max(64).default(""),
});
export type GithubSettings = z.infer<typeof githubSettingsSchema>;

export const deviceFlowStartSchema = z.object({
  flowId: z.string(),
  userCode: z.string(),
  verificationUri: z.string(),
  expiresAt: z.string(),
});
export type DeviceFlowStart = z.infer<typeof deviceFlowStartSchema>;

export const deviceFlowStateSchema = z.object({
  status: z.enum(["pending", "done", "expired", "denied", "failed"]),
  error: z.string().nullable(),
});
export type DeviceFlowState = z.infer<typeof deviceFlowStateSchema>;
