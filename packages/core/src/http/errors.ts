import { AppError } from "@agentic/contracts";
import { currentLogContext, moduleLogger } from "@agentic/logger";
import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const log = moduleLogger("core.http");

const STATUS: Record<string, ContentfulStatusCode> = {
  validation_failed: 400,
  unauthorized: 401,
  "auth.required": 401,
  "auth.session_invalid": 401,
  "auth.invalid_credentials": 401,
  forbidden: 403,
  "tool.dir_denied": 403,
  not_found: 404,
  conflict: 409,
  "auth.rate_limited": 429,
  unavailable: 503,
};

/**
 * Maps anything thrown to the one `AppError` JSON shape and a matching
 * status, with the request's trace id. Unexpected errors are logged with
 * their stack; expected ones (404, validation) only at debug.
 */
export const handleError: ErrorHandler = (err, c) => {
  const error = AppError.from(err);
  const status = STATUS[error.code] ?? 500;
  const fields = { err, code: error.code, method: c.req.method, path: c.req.path, status };
  if (status >= 500) log.error(fields, error.message);
  else log.debug(fields, error.message);
  error.traceId ??= currentLogContext().traceId ?? c.res.headers.get("x-trace-id") ?? undefined;
  return c.json(error.toJSON(), status);
};
