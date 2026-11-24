import type { BaseBinding, Binding, Bindings, NodeSlot } from "@agentic/contracts";
import { applyJsonLogic } from "./jsonlogic";

/** What bindings and conditions read: `input.<field>` and `nodes.<id>.output.<field>`. */
export type BindingScope = {
  input: Record<string, unknown>;
  nodes: Record<string, Pick<NodeSlot, "output" | "status" | "runs">>;
};

/** One source's value, or `undefined` when it is missing (unset field, node not run). */
export function resolveBinding(binding: BaseBinding, scope: BindingScope): unknown {
  switch (binding.kind) {
    case "input":
      return scope.input[binding.field];
    case "node": {
      const slot = scope.nodes[binding.node];
      if (!slot) return undefined;
      return binding.field === null ? slot.output : slot.output[binding.field];
    }
    case "literal":
      return binding.value;
    case "expression":
      return applyJsonLogic(binding.logic, scope) ?? undefined;
  }
}

function resolveWithFallback(binding: Binding, scope: BindingScope): unknown {
  const value = resolveBinding(binding, scope);
  if (value !== undefined || !binding.fallback) return value;
  return resolveBinding(binding.fallback, scope);
}

/** A node's input: each bound field, skipping the ones whose sources are all missing. */
export function projectInput(bindings: Bindings, scope: BindingScope): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, binding] of Object.entries(bindings)) {
    const value = resolveWithFallback(binding, scope);
    if (value !== undefined) out[field] = value;
  }
  return out;
}
