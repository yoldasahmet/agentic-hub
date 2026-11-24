import { timingSafeEqual } from "node:crypto";
import { AppError } from "@agentic/contracts";
import type { MiddlewareHandler } from "hono";

/** Constant-time comparison of a presented token with the per-launch one. */
export function tokenMatches(expected: string, presented: string | null | undefined): boolean {
  if (!presented) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Every route except `/health` needs `Authorization: Bearer <token>` (D9). */
export function requireToken(token: string): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!tokenMatches(token, presented))
      throw new AppError("unauthorized", "Missing or invalid token");
    await next();
  };
}

/**
 * Rejects requests whose Host is not the loopback address, so a web page
 * can't reach Core through DNS rebinding even before the token check.
 */
export const requireLoopbackHost: MiddlewareHandler = async (c, next) => {
  const host = c.req.header("host") ?? "";
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
    throw new AppError("forbidden", "Core only accepts loopback requests");
  }
  await next();
};

const LOOPBACK_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

/**
 * Origins that may call Core: none (the CLI, Node), the packaged renderer
 * (`file://`, which Chromium may report as `null`), and loopback pages (the
 * Vite dev server). A web page elsewhere is refused before the token check.
 */
export function isTrustedOrigin(origin: string | undefined | null): boolean {
  if (!origin || origin === "null" || origin === "file://") return true;
  return LOOPBACK_ORIGIN.test(origin);
}

export const requireTrustedOrigin: MiddlewareHandler = async (c, next) => {
  if (!isTrustedOrigin(c.req.header("origin"))) {
    throw new AppError("forbidden", "Core does not accept requests from this origin");
  }
  await next();
};
