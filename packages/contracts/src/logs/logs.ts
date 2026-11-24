import { z } from "zod";

/** pino's levels, lowest first. Log files store the label, not the number. */
export const logLevels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
export const logLevelSchema = z.enum(logLevels);
export type LogLevel = z.infer<typeof logLevelSchema>;

/** Which process wrote a line: Electron main (renderer reports go through it) or Core. */
export const logProcessSchema = z.string().min(1).max(40);

/**
 * One log line as the viewer sees it. Correlation ids are lifted out of the
 * line; every other field stays in `data` (already redacted when written).
 */
export const logEntrySchema = z.object({
  time: z.string(),
  level: logLevelSchema,
  proc: logProcessSchema,
  module: z.string().optional(),
  msg: z.string(),
  runId: z.string().optional(),
  threadId: z.string().optional(),
  traceId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});
export type LogEntry = z.infer<typeof logEntrySchema>;

const filterText = z.string().trim().max(200).optional();

/** Newest first. `level` is a minimum; the text filters match exactly, `search` is a substring. */
export const logQuerySchema = z.object({
  level: logLevelSchema.default("info"),
  module: filterText,
  runId: filterText,
  traceId: filterText,
  search: filterText,
  limit: z.number().int().min(1).max(2000).default(500),
});
export type LogQuery = z.input<typeof logQuerySchema>;

export const logQueryResultSchema = z.object({
  entries: z.array(logEntrySchema),
  /** Modules seen in the scanned window, for the module filter. */
  modules: z.array(z.string()),
  dir: z.string(),
});
export type LogQueryResult = z.infer<typeof logQueryResultSchema>;

/** A renderer report (error boundary, unhandled rejection), written to main's log. */
export const rendererLogInputSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  msg: z.string().min(1).max(2000),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type RendererLogInput = z.infer<typeof rendererLogInputSchema>;
