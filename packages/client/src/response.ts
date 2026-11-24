import { AppError, appErrorSchema } from "@agentic/contracts";
import type { ZodType } from "zod";

/** Zod at the client boundary: errors become AppError, bodies are parsed, never cast. */
export async function parseResponse<T>(response: Response, schema: ZodType<T>): Promise<T> {
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = appErrorSchema.safeParse(body);
    const traceId = error.data?.traceId ?? response.headers.get("x-trace-id") ?? undefined;
    if (error.success) {
      throw new AppError(error.data.code, error.data.message, error.data.details, traceId);
    }
    throw new AppError("unavailable", `Core responded ${response.status}`, undefined, traceId);
  }
  return schema.parse(body);
}
