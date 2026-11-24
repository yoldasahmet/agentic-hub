import { redact } from "@agentic/cli-bridge";
import { AppError } from "@agentic/contracts";

/** A signal that fires on the caller's cancel or when the call runs out of time. */
export function deadline(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Races a call against its deadline, so a tool that ignores the signal still stops waiting. */
export async function withDeadline<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw timeoutError(signal);
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(timeoutError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([work, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

function timeoutError(signal: AbortSignal): AppError {
  return signal.reason instanceof DOMException && signal.reason.name === "TimeoutError"
    ? new AppError("tool.timeout", "The tool call timed out")
    : new AppError("tool.cancelled", "The tool call was cancelled");
}

/**
 * Masks secrets in every string of a result, then keeps it within the
 * byte budget: a result too big becomes its JSON text cut at the limit,
 * so the model sees that it was cut instead of a silently partial object.
 */
export function limitOutput(value: unknown, maxBytes: number, secrets: readonly string[]): unknown {
  const masked = maskStrings(value, secrets);
  const text = JSON.stringify(masked) ?? "null";
  if (Buffer.byteLength(text) <= maxBytes) return masked;
  const cut = Buffer.from(text).subarray(0, maxBytes).toString("utf8");
  return { truncated: true, limitBytes: maxBytes, text: cut };
}

/** Masks secret values and token shapes in every string of a value, keeping its shape. */
export function maskStrings<T>(value: T, secrets: readonly string[]): T;
export function maskStrings(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === "string") return redact(value, secrets);
  if (Array.isArray(value)) return value.map((v) => maskStrings(v, secrets));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskStrings(v, secrets)]));
  }
  return value;
}
