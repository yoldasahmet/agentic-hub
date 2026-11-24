import { AppError } from "@agentic/contracts";
import { z } from "zod";

/** Jira's error body: messages plus per-field errors (e.g. a bad JQL clause). */
const errorBodySchema = z.object({
  errorMessages: z.array(z.string()).default([]),
  errors: z.record(z.string(), z.string()).default({}),
});

function messageOf(status: number, body: unknown): string {
  const parsed = errorBodySchema.safeParse(body);
  const parts = parsed.success
    ? [
        ...parsed.data.errorMessages,
        ...Object.entries(parsed.data.errors).map(([k, v]) => `${k}: ${v}`),
      ]
    : [];
  return `Jira: ${parts.join("; ") || `HTTP ${status}`}`;
}

/** Maps a failed Jira response to the app's error codes, so routes and tools speak one shape. */
export function jiraError(status: number, body: unknown): AppError {
  const message = messageOf(status, body);
  if (status === 401) return new AppError("jira.unauthorized", message);
  if (status === 403) return new AppError("forbidden", message);
  if (status === 404) return new AppError("not_found", message);
  if (status === 400) return new AppError("validation_failed", message);
  if (status === 409) return new AppError("conflict", message);
  if (status === 429) return new AppError("jira.rate_limited", message);
  return new AppError("jira.failed", message, { status });
}
