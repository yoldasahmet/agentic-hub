import { AppError, type JsonSchema } from "@agentic/contracts";
import { type ZodType, z } from "zod";

export type SchemaCheck = { ok: true; value: unknown } | { ok: false; issues: string[] };

const cache = new Map<string, ZodType>();

/**
 * Validates a value against an agent's JSON Schema output contract, via
 * Zod's JSON Schema import. Compiled validators are cached by schema text.
 */
export function checkJsonSchema(schema: JsonSchema, value: unknown): SchemaCheck {
  const result = compile(schema).safeParse(value);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
  };
}

function compile(schema: JsonSchema): ZodType {
  const key = JSON.stringify(schema);
  let compiled = cache.get(key);
  if (!compiled) {
    try {
      compiled = z.fromJSONSchema(schema);
    } catch (err) {
      throw new AppError(
        "llm.schema_unsupported",
        "The output schema is not a supported JSON Schema",
        {
          cause: err instanceof Error ? err.message : String(err),
        },
      );
    }
    if (cache.size > 200) cache.clear();
    cache.set(key, compiled);
  }
  return compiled;
}
