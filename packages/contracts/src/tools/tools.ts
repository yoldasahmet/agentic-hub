import { z } from "zod";
import { jsonSchemaSchema } from "../llm/request";

/**
 * How much a tool can change: `read` only looks, `write` changes files or
 * remote state, `dangerous` runs arbitrary commands or deletes. The
 * agent's approval policy maps each level to allow, ask, or deny.
 */
export const toolPermissions = ["read", "write", "dangerous"] as const;
export const toolPermissionSchema = z.enum(toolPermissions);
export type ToolPermission = z.infer<typeof toolPermissionSchema>;

/** Built-ins are dotted (`fs.read`); MCP tools are `mcp.<server>.<tool>`. */
export const toolNameSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z][a-z0-9-]*(?:\.[A-Za-z0-9_-]+)+$/, "Use a dotted name such as fs.read");

export const toolSourceSchema = z.enum(["builtin", "mcp"]);
export type ToolSource = z.infer<typeof toolSourceSchema>;

export const toolDescriptorSchema = z.object({
  name: toolNameSchema,
  title: z.string(),
  description: z.string(),
  permission: toolPermissionSchema,
  inputSchema: jsonSchemaSchema,
  source: toolSourceSchema,
  /** The MCP server a tool comes from. */
  server: z.string().optional(),
});
export type ToolDescriptor = z.infer<typeof toolDescriptorSchema>;

export const approvalDecisionSchema = z.enum(["allow", "ask", "deny"]);
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

/** Per agent: what happens when it uses a tool of each permission level. */
export const approvalPolicySchema = z.object({
  read: approvalDecisionSchema.default("allow"),
  write: approvalDecisionSchema.default("ask"),
  dangerous: approvalDecisionSchema.default("ask"),
});
export type ApprovalPolicy = z.infer<typeof approvalPolicySchema>;
export const defaultApprovalPolicy: ApprovalPolicy = {
  read: "allow",
  write: "ask",
  dangerous: "ask",
};

/**
 * The gate a tool approval raises. `call` approves one call of a `tool`
 * agent with its input; `run` grants an `llm` agent the listed tools for
 * this run, asked before the model starts so a resume never repeats a call.
 */
export const toolApprovalRequestSchema = z.object({
  kind: z.literal("tool.approval"),
  scope: z.enum(["call", "run"]),
  tools: z.array(
    z.object({ name: z.string(), permission: toolPermissionSchema, description: z.string() }),
  ),
  input: z.record(z.string(), z.unknown()).optional(),
  workingDir: z.string(),
});
export type ToolApprovalRequest = z.infer<typeof toolApprovalRequestSchema>;

export const toolApprovalAnswerSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(2000).optional(),
});
export type ToolApprovalAnswer = z.infer<typeof toolApprovalAnswerSchema>;

/** What a tool agent or the tool loop writes as a `custom` run event per call. */
export const toolCallEventSchema = z.object({
  kind: z.literal("tool"),
  name: z.string(),
  status: z.enum(["ok", "error", "denied"]),
  durationMs: z.number().int().nonnegative(),
  summary: z.string(),
});
export type ToolCallEvent = z.infer<typeof toolCallEventSchema>;

/** Every tool a workspace can attach, and which MCP servers could not be reached. */
export const toolCatalogSchema = z.object({
  tools: z.array(toolDescriptorSchema),
  servers: z.array(z.object({ name: z.string(), ok: z.boolean(), error: z.string().optional() })),
});
export type ToolCatalog = z.infer<typeof toolCatalogSchema>;
