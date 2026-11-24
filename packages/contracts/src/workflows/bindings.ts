import { z } from "zod";

/** A JSON-logic rule (`{ "==": [{ "var": "nodes.review.output.approved" }, true] }`). */
export const jsonLogicRuleSchema = z.record(z.string(), z.json());
export type JsonLogicRule = z.infer<typeof jsonLogicRuleSchema>;

/**
 * Where a node input (or a workflow output) gets its value: a workflow
 * input, a field of an upstream node's output (`field: null` takes the
 * whole output), a literal, or a JSON-logic expression over the state.
 */
const baseBindingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("input"), field: z.string().min(1).max(64) }),
  z.object({
    kind: z.literal("node"),
    node: z.string().min(1).max(40),
    field: z.string().min(1).max(64).nullable(),
  }),
  z.object({ kind: z.literal("literal"), value: z.json() }),
  z.object({ kind: z.literal("expression"), logic: jsonLogicRuleSchema }),
]);
export type BaseBinding = z.infer<typeof baseBindingSchema>;

/** `fallback` is used when the primary source is missing (a skipped branch, an absent field). */
export const bindingSchema = z.intersection(
  baseBindingSchema,
  z.object({ fallback: baseBindingSchema.optional() }),
);
export type Binding = z.infer<typeof bindingSchema>;

export const bindingsSchema = z.record(z.string(), bindingSchema);
export type Bindings = z.infer<typeof bindingsSchema>;
