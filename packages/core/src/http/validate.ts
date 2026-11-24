import { AppError } from "@agentic/contracts";
import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { type ZodType, z } from "zod";

/** Zod at the HTTP boundary: a failure becomes a `validation_failed` AppError. */
export function validate<T extends keyof ValidationTargets, S extends ZodType>(
  target: T,
  schema: S,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new AppError("validation_failed", `Invalid ${target}`, z.treeifyError(result.error));
    }
  });
}
