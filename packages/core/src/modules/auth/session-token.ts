import { createHash, randomBytes } from "node:crypto";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A session used with less than this left is pushed out to a full TTL again. */
export const SESSION_RENEW_MS = 15 * 24 * 60 * 60 * 1000;

export function newSessionToken(): string {
  return `ags_${randomBytes(32).toString("base64url")}`;
}

/** Tokens are 256 random bits, so a fast hash is enough (no salt or stretching needed). */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
