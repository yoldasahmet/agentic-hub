import { z } from "zod";
import { appErrorSchema } from "../errors";
import { idSchema, isoDateTimeSchema } from "../ids";
import { secretNameSchema } from "../secrets";
import { toolDescriptorSchema } from "./tools";

/** Lowercase so it fits CLI tool names such as `mcp__<server>__<tool>`. */
export const mcpServerNameSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits, and single dashes");

const envNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Use an env variable name");
const headerNameSchema = z.string().regex(/^[A-Za-z0-9-]+$/, "Use a header name");

/**
 * Secrets are vault names only (D8): `secretEnv` and `secretHeaders` map an
 * env variable or header to a secret Core reads from the vault at connect.
 */
export const mcpStdioConfigSchema = z.object({
  transport: z.literal("stdio"),
  command: z.string().min(1).max(1024),
  args: z.array(z.string().max(4096)).max(64).default([]),
  env: z.record(envNameSchema, z.string().max(4096)).default({}),
  secretEnv: z.record(envNameSchema, secretNameSchema).default({}),
});
export const mcpHttpConfigSchema = z.object({
  transport: z.literal("http"),
  url: z.url({ protocol: /^https?$/ }),
  headers: z.record(headerNameSchema, z.string().max(4096)).default({}),
  secretHeaders: z.record(headerNameSchema, secretNameSchema).default({}),
});
export const mcpServerConfigSchema = z.discriminatedUnion("transport", [
  mcpStdioConfigSchema,
  mcpHttpConfigSchema,
]);
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type McpServerConfigInput = z.input<typeof mcpServerConfigSchema>;

export const mcpServerSchema = z.object({
  id: idSchema,
  name: mcpServerNameSchema,
  enabled: z.boolean(),
  config: mcpServerConfigSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type McpServer = z.infer<typeof mcpServerSchema>;

export const mcpServerInputSchema = z.object({
  name: mcpServerNameSchema,
  enabled: z.boolean().default(true),
  config: mcpServerConfigSchema,
});
export type McpServerInput = z.input<typeof mcpServerInputSchema>;

/**
 * A server as it travels in a workflow bundle. It is installed disabled:
 * a stdio server runs a command, so a person reviews it before it can.
 */
export const bundledMcpServerSchema = mcpServerInputSchema.omit({ enabled: true });
export type BundledMcpServer = z.infer<typeof bundledMcpServerSchema>;

/** Connects and lists the server's tools. */
export const mcpTestResultSchema = z.object({
  ok: z.boolean(),
  tools: z.array(toolDescriptorSchema),
  error: appErrorSchema.optional(),
});
export type McpTestResult = z.infer<typeof mcpTestResultSchema>;

/**
 * A server ready to launch, secrets resolved. It never leaves Core except
 * to a CLI that runs the server itself (private config or child environment).
 */
export type McpServerLaunch = { name: string; config: McpServerConfig; secrets: SecretValues };
export type SecretValues = Record<string, string>;
