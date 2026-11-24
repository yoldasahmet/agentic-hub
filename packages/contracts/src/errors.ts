import { z } from "zod";

/**
 * Error codes are an open set: modules add their own (e.g. "workflow.invalid").
 * These are the shared ones every layer may use.
 */
export const commonErrorCodes = [
  "validation_failed",
  "not_found",
  "conflict",
  "unauthorized",
  "forbidden",
  "unavailable",
  "internal",
] as const;
export type CommonErrorCode = (typeof commonErrorCodes)[number];

/** The single error shape returned by every HTTP route, WS message, and IPC call. */
export const appErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  details: z.unknown().optional(),
  /** Set by Core on HTTP errors; the log viewer filters by it. */
  traceId: z.string().optional(),
});
export type AppErrorShape = z.infer<typeof appErrorSchema>;

export class AppError extends Error {
  readonly code: string;
  readonly details: unknown;
  traceId: string | undefined;

  constructor(
    code: CommonErrorCode | (string & {}),
    message: string,
    details?: unknown,
    traceId?: string,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.traceId = traceId;
  }

  toJSON(): AppErrorShape {
    const shape: AppErrorShape = { code: this.code, message: this.message };
    if (this.details !== undefined) shape.details = this.details;
    if (this.traceId !== undefined) shape.traceId = this.traceId;
    return shape;
  }

  /** Normalizes anything thrown into an AppError without leaking stack traces. */
  static from(err: unknown): AppError {
    if (err instanceof AppError) return err;
    if (err instanceof z.ZodError) {
      return new AppError("validation_failed", "Input failed validation", z.treeifyError(err));
    }
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new AppError("internal", message);
  }
}
