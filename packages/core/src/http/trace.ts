import { randomUUID } from "node:crypto";
import { moduleLogger, withLogContext } from "@agentic/logger";
import type { MiddlewareHandler } from "hono";

const log = moduleLogger("core.http");
const TRACE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Gives every request a trace id (the caller's `x-trace-id`, or a new one),
 * echoes it in the response, and puts it on every log line the request
 * causes, so an error toast can link straight to its logs.
 */
export const traceRequests: MiddlewareHandler = async (c, next) => {
  const given = c.req.header("x-trace-id");
  const traceId = given && TRACE_ID.test(given) ? given : randomUUID();
  c.header("x-trace-id", traceId);
  const started = Date.now();
  await withLogContext({ traceId }, async () => {
    await next();
    const fields = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - started,
    };
    if (c.res.status >= 500) log.warn(fields, "request failed");
    else log.debug(fields, "request");
  });
};
