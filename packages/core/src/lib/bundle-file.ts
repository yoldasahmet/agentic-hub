import { AppError, type BundleFormat } from "@agentic/contracts";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";

/** Parses an imported JSON or YAML file against a bundle schema, with readable issues. */
export function parseBundleFile<T extends z.ZodType>(
  input: { format: BundleFormat; content: string },
  schema: T,
  what: string,
): z.infer<T> {
  let raw: unknown;
  try {
    raw = input.format === "yaml" ? parseYaml(input.content) : JSON.parse(input.content);
  } catch (err) {
    throw new AppError(
      "validation_failed",
      `This file is not valid ${input.format.toUpperCase()}`,
      {
        cause: err instanceof Error ? err.message : String(err),
      },
    );
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("validation_failed", `This file is not ${what}`, {
      issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    });
  }
  return parsed.data;
}
