import type { CoreSecrets } from "@agentic/contracts";
import { setSecretValues } from "@agentic/logger";

/**
 * Provider secrets handed over by main (or the headless env). Memory only:
 * never written to disk, the DB, logs, or events. Main replaces the whole
 * set whenever one changes in the vault. Every value is also masked in logs.
 */
export class SecretStore {
  private values: CoreSecrets;

  constructor(initial: CoreSecrets = {}) {
    this.values = { ...initial };
    setSecretValues(this.allValues());
  }

  get(name: string): string | undefined {
    return this.values[name];
  }

  /** Every value, to mask in tool output. */
  allValues(): string[] {
    return Object.values(this.values);
  }

  /** A secret Core obtained itself (device sign-in); main persists it and later replaces the set. */
  set(name: string, value: string): void {
    this.values = { ...this.values, [name]: value };
    setSecretValues(this.allValues());
  }

  replace(next: CoreSecrets): void {
    this.values = { ...next };
    setSecretValues(this.allValues());
  }
}
