import { logLevelSchema } from "@agentic/contracts";
import { z } from "zod";

const id = z.string().trim().min(1).max(200).optional().catch(undefined);

/** `/settings/logs?runId=…&traceId=…`: links from toasts, run pages, and errors land filtered. */
export const logSearchSchema = z.object({
  level: logLevelSchema.optional().catch(undefined),
  module: id,
  runId: id,
  traceId: id,
});
export type LogSearch = z.infer<typeof logSearchSchema>;
