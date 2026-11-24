import { redactText } from "@agentic/logger";

/**
 * Masks secrets in CLI output before it reaches errors, events, or logs:
 * known values (e.g. vault entries handed to a CLI) and common token shapes.
 */
export const redact = (text: string, secrets: readonly string[] = []): string =>
  redactText(text, secrets);

/** Keeps the tail of a stream (errors are usually last) within a byte budget. */
export class TailBuffer {
  private text = "";

  constructor(private readonly limit = 16_384) {}

  push(chunk: string): void {
    this.text += chunk;
    if (this.text.length > this.limit) this.text = this.text.slice(-this.limit);
  }

  toString(): string {
    return this.text;
  }
}
