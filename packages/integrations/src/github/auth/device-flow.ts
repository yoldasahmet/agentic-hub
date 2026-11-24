import { AppError } from "@agentic/contracts";
import { z } from "zod";

/** GitHub's OAuth device flow (RFC 8628) for an OAuth app's public client id. */
const codeSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  expires_in: z.number(),
  interval: z.number().default(5),
});
export type DeviceCode = z.infer<typeof codeSchema>;

const tokenSchema = z.union([
  z.object({ access_token: z.string().min(1), scope: z.string().default("") }),
  z.object({
    error: z.string(),
    error_description: z.string().optional(),
    interval: z.number().optional(),
  }),
]);

/** `repo` covers private repos, PRs, and pushes; `read:org` lists org repos. */
export const DEVICE_SCOPES = "repo read:org";

async function post(url: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new AppError("github.failed", `GitHub sign-in failed (${res.status})`);
  return res.json();
}

export async function requestDeviceCode(clientId: string, webUrl: string): Promise<DeviceCode> {
  const raw = await post(`${webUrl}/login/device/code`, {
    client_id: clientId,
    scope: DEVICE_SCOPES,
  });
  return codeSchema.parse(raw);
}

export type PollResult =
  | { status: "done"; token: string }
  | { status: "pending"; interval?: number }
  | { status: "expired" | "denied" | "failed"; error: string };

/** One poll; the caller waits `interval` seconds between polls (longer after `slow_down`). */
export async function pollDeviceToken(
  clientId: string,
  deviceCode: string,
  webUrl: string,
): Promise<PollResult> {
  const raw = await post(`${webUrl}/login/oauth/access_token`, {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  const parsed = tokenSchema.parse(raw);
  if ("access_token" in parsed) return { status: "done", token: parsed.access_token };
  if (parsed.error === "authorization_pending") return { status: "pending" };
  if (parsed.error === "slow_down") return { status: "pending", interval: parsed.interval };
  if (parsed.error === "expired_token") return { status: "expired", error: "The code expired" };
  if (parsed.error === "access_denied") return { status: "denied", error: "Sign-in was cancelled" };
  return { status: "failed", error: parsed.error_description ?? parsed.error };
}
