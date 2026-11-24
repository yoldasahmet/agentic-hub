import { AppError } from "@agentic/contracts";

type HttpError = {
  status: number;
  message: string;
  response?: { headers?: Record<string, unknown> };
};

function isHttpError(err: unknown): err is HttpError {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof err.status === "number" &&
    "message" in err &&
    typeof err.message === "string"
  );
}

/** Maps Octokit's RequestError to the app's error codes, so routes and tools speak one shape. */
export function githubError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (!isHttpError(err)) return AppError.from(err);
  const message = `GitHub: ${err.message}`;
  if (err.status === 401) return new AppError("github.unauthorized", message);
  if (err.status === 403 || err.status === 429) {
    const remaining = err.response?.headers?.["x-ratelimit-remaining"];
    return new AppError(remaining === "0" ? "github.rate_limited" : "forbidden", message);
  }
  if (err.status === 404) return new AppError("not_found", message);
  if (err.status === 409 || err.status === 422) return new AppError("conflict", message);
  return new AppError("github.failed", message, { status: err.status });
}

/** Runs a GitHub call and rethrows its failure as an AppError. */
export async function gh<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (err) {
    throw githubError(err);
  }
}
