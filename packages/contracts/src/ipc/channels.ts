import { z } from "zod";
import { sessionTokenSchema } from "../auth/auth";
import { coreStatusSchema } from "../core/runtime";
import {
  connectionTestResultSchema,
  databaseStatusSchema,
  databaseTargetInputSchema,
} from "../database";
import { logQueryResultSchema, logQuerySchema, rendererLogInputSchema } from "../logs/logs";
import {
  secretMetaSchema,
  secretNameSchema,
  secretValueSchema,
  vaultStatusSchema,
} from "../secrets";

const pickedFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  mediaType: z.string(),
  size: z.number().int().nonnegative(),
});
export type PickedFile = z.infer<typeof pickedFileSchema>;

/** Request/reply channels the renderer may invoke. Main validates both sides. */
export const ipcChannels = {
  "app.info": {
    input: z.undefined(),
    output: z.object({
      name: z.string(),
      version: z.string(),
      platform: z.string(),
      isPackaged: z.boolean(),
    }),
  },
  "secrets.status": { input: z.undefined(), output: vaultStatusSchema },
  "secrets.list": { input: z.undefined(), output: z.array(secretMetaSchema) },
  "secrets.set": {
    input: z.object({ name: secretNameSchema, value: secretValueSchema }),
    output: secretMetaSchema,
  },
  "secrets.delete": {
    input: z.object({ name: secretNameSchema }),
    output: z.object({ deleted: z.boolean() }),
  },
  "database.status": { input: z.undefined(), output: databaseStatusSchema },
  "database.test": { input: databaseTargetInputSchema, output: connectionTestResultSchema },
  /** Saves the target (URL into the vault), then reconnects and migrates. */
  "database.switch": { input: databaseTargetInputSchema, output: databaseStatusSchema },
  "database.migrate": { input: z.undefined(), output: databaseStatusSchema },
  /** Saves a snapshot of the local DB where the user picks (Core and Postgres restart). */
  "database.backup": {
    input: z.undefined(),
    output: z.object({ path: z.string().nullable(), bytes: z.number().int().nonnegative() }),
  },
  /** Replaces the local DB with a snapshot the user picks, after a confirmation. */
  "database.restore": {
    input: z.undefined(),
    output: z.object({ restored: z.boolean(), status: databaseStatusSchema }),
  },
  /** Core's address and per-launch token once it is ready. */
  "core.status": { input: z.undefined(), output: coreStatusSchema },
  /** The signed-in session token kept in the vault, for the renderer's Core client (P17). */
  "auth.session": {
    input: z.undefined(),
    output: z.object({ token: sessionTokenSchema.nullable() }),
  },
  /** Keeps a new session token in the vault after sign-in; null forgets it (sign-out). */
  "auth.setSession": {
    input: z.object({ token: sessionTokenSchema.nullable() }),
    output: z.object({ ok: z.boolean() }),
  },
  /** Native file picker (chat attachments). Main stats each file; nothing is read here. */
  "dialog.openFiles": {
    input: z.undefined(),
    output: z.array(pickedFileSchema),
  },
  /** Native folder picker (a chat's working dir). */
  "dialog.openDirectory": {
    input: z.object({ defaultPath: z.string().max(4096).optional() }),
    output: z.object({ path: z.string().nullable() }),
  },
  /** Gates waiting for the user: the dock badge, plus a notification for a new one. */
  "app.attention": {
    input: z.object({
      pending: z.number().int().min(0).max(9999),
      notify: z.object({ title: z.string().max(200), body: z.string().max(500) }).optional(),
    }),
    output: z.object({ ok: z.boolean() }),
  },
  /** Main's and Core's log files, newest first. Read by main, so it works while Core is down. */
  "logs.query": { input: logQuerySchema, output: logQueryResultSchema },
  /** A renderer error (boundary, unhandled rejection) for main's log. */
  "logs.write": { input: rendererLogInputSchema, output: z.object({ ok: z.boolean() }) },
  /** Copies a redacted diagnostics bundle (versions, status, recent logs) to the clipboard. */
  "logs.copyDiagnostics": {
    input: z.undefined(),
    output: z.object({ bytes: z.number().int().nonnegative(), entries: z.number().int() }),
  },
  /** Opens the log folder in Finder. */
  "logs.openFolder": { input: z.undefined(), output: z.object({ ok: z.boolean() }) },
} as const;

export type IpcChannel = keyof typeof ipcChannels;
export type IpcInput<C extends IpcChannel> = z.input<(typeof ipcChannels)[C]["input"]>;
export type IpcOutput<C extends IpcChannel> = z.output<(typeof ipcChannels)[C]["output"]>;

export const ipcChannelNames = Object.keys(ipcChannels) as IpcChannel[];

export type IpcContract<C extends IpcChannel> = {
  input: z.ZodType<z.output<(typeof ipcChannels)[C]["input"]>, IpcInput<C>>;
  output: z.ZodType<IpcOutput<C>>;
};

/**
 * The schemas for one channel, typed per channel. TypeScript cannot relate
 * `ipcChannels[C]` to `C` (correlated union), so this is the one place that
 * narrows it. The cast covers schema objects only; data is still parsed.
 */
export function ipcContract<C extends IpcChannel>(channel: C): IpcContract<C> {
  return ipcChannels[channel] as unknown as IpcContract<C>;
}
