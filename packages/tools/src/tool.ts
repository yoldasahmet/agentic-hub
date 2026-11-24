import { AppError, type ToolDescriptor, type ToolPermission } from "@agentic/contracts";
import { z } from "zod";

/** What every call gets: a checked working dir, a deadline signal, and the output budget. */
export type ToolContext = {
  /** The run's workspace, for tools whose account is per workspace (Jira). */
  workspaceId: string;
  /** Already inside the allowlist (guardrails/allowlist). */
  cwd: string;
  signal: AbortSignal;
  timeoutMs: number;
  maxOutputBytes: number;
  /** Known secret values to mask in anything a tool returns. */
  secrets: readonly string[];
};

/** A built-in tool: a Zod input, a permission level, and a function. */
export type ToolDefinition = {
  descriptor: ToolDescriptor;
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
};

/**
 * Declares a built-in tool. The JSON Schema for prompts and the UI comes
 * from the Zod input, so the two never drift; input is parsed before `run`.
 */
export function defineTool<S extends z.ZodObject>(spec: {
  name: string;
  title: string;
  description: string;
  permission: ToolPermission;
  input: S;
  run(input: z.infer<S>, ctx: ToolContext): Promise<unknown>;
}): ToolDefinition {
  const inputSchema = z.toJSONSchema(spec.input, { io: "input" });
  return {
    descriptor: {
      name: spec.name,
      title: spec.title,
      description: spec.description,
      permission: spec.permission,
      inputSchema,
      source: "builtin",
    },
    async run(raw, ctx) {
      const parsed = spec.input.safeParse(raw);
      if (!parsed.success) {
        throw new AppError("validation_failed", `Invalid input for ${spec.name}`, {
          issues: parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`),
        });
      }
      return spec.run(parsed.data, ctx);
    },
  };
}
