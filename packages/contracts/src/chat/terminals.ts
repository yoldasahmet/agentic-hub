import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../ids";
import { providerIdSchema } from "../llm/providers";

/**
 * Terminal mode: an interactive CLI session in a real PTY, owned by Core.
 * Output goes over the WebSocket; a session outlives the socket, so a
 * reconnecting client re-attaches and gets the recent output again.
 */
export const terminalSchema = z.object({
  id: idSchema,
  chatId: idSchema.nullable(),
  providerId: providerIdSchema,
  command: z.string(),
  cwd: z.string(),
  pid: z.number().int(),
  exitCode: z.number().int().nullable(),
  createdAt: isoDateTimeSchema,
});
export type Terminal = z.infer<typeof terminalSchema>;

const sizeFields = {
  cols: z.number().int().min(10).max(500).default(120),
  rows: z.number().int().min(4).max(200).default(32),
};

export const openTerminalInputSchema = z.object({
  providerId: providerIdSchema,
  chatId: idSchema.optional(),
  /** Defaults to the chat's working dir, then the home dir. */
  cwd: z.string().min(1).max(1024).optional(),
  /** MCP servers and skills the session starts with, by name (CLIs with session flags). */
  mcpServers: z.array(z.string().max(200)).max(50).default([]),
  skills: z.array(z.string().max(200)).max(50).default([]),
  ...sizeFields,
});
export type OpenTerminalInput = z.input<typeof openTerminalInputSchema>;

export const terminalIdParamSchema = z.object({ terminalId: idSchema });

/** Client → Core over the socket. */
export const terminalClientMessageSchemas = [
  z.object({ type: z.literal("terminal.attach"), terminalId: idSchema }),
  z.object({ type: z.literal("terminal.detach"), terminalId: idSchema }),
  z.object({
    type: z.literal("terminal.input"),
    terminalId: idSchema,
    data: z.string().max(16_384),
  }),
  z.object({
    type: z.literal("terminal.resize"),
    terminalId: idSchema,
    cols: sizeFields.cols,
    rows: sizeFields.rows,
  }),
] as const;

/** Core → client. `data` is raw terminal output (ANSI included). */
export const terminalServerMessageSchemas = [
  z.object({ type: z.literal("terminal.data"), terminalId: idSchema, data: z.string() }),
  z.object({ type: z.literal("terminal.exit"), terminalId: idSchema, code: z.number().int() }),
] as const;
