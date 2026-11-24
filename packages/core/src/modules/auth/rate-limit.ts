import { AppError } from "@agentic/contracts";

type Entry = { failures: number; resetAt: number };

/**
 * Failed sign-ins per email, in memory. Slows password guessing against
 * one account; Core is loopback-only, so this is defense in depth.
 */
export class SignInLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly maxFailures = 10,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): void {
    const entry = this.current(key);
    if (entry && entry.failures >= this.maxFailures) {
      const minutes = Math.ceil((entry.resetAt - this.now()) / 60_000);
      throw new AppError(
        "auth.rate_limited",
        `Too many failed sign-ins. Try again in ${minutes} min.`,
      );
    }
  }

  fail(key: string): void {
    const entry = this.current(key) ?? { failures: 0, resetAt: this.now() + this.windowMs };
    entry.failures += 1;
    this.entries.set(key, entry);
  }

  succeed(key: string): void {
    this.entries.delete(key);
  }

  private current(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.resetAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }
}
