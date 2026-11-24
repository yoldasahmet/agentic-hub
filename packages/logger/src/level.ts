import { type LogLevel, logLevelSchema } from "@agentic/contracts";

/** `AGENTIC_LOG_LEVEL`, or the fallback when it is unset or not a level. */
export function envLogLevel(env: Record<string, string | undefined>, fallback: LogLevel): LogLevel {
  const parsed = logLevelSchema.safeParse(env.AGENTIC_LOG_LEVEL?.toLowerCase());
  return parsed.success ? parsed.data : fallback;
}
