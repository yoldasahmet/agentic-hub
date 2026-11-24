import type { ValidationCode, ValidationIssue } from "@agentic/contracts";

type Where = Pick<ValidationIssue, "node" | "edge" | "field">;

export const error = (
  code: ValidationCode,
  message: string,
  where: Where = {},
): ValidationIssue => ({
  code,
  severity: "error",
  message,
  ...where,
});

export const warning = (
  code: ValidationCode,
  message: string,
  where: Where = {},
): ValidationIssue => ({ code, severity: "warning", message, ...where });
