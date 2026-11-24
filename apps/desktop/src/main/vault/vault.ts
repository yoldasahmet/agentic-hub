import {
  AppError,
  isManagedSecret,
  type SecretMeta,
  type SecretName,
  type VaultStatus,
} from "@agentic/contracts";
import { safeStorage } from "electron";
import { readVaultFile, type VaultFile, writeVaultFile } from "./vault-file";

/** Linux without a keyring falls back to a fixed key; only dev builds accept that. */
const WEAK_BACKENDS = new Set(["basic_text", "unknown"]);

/**
 * The secrets vault. Values are encrypted with Electron's safeStorage
 * (the macOS Keychain) and only ever decrypted in the main process.
 */
export class Vault {
  private file: VaultFile | undefined;
  // Serializes writes so concurrent IPC calls never lose an update.
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly path: string,
    private readonly allowWeakBackend: boolean,
  ) {
    // Dev on Linux without a keyring (CI, containers) opts in to the fixed-key fallback.
    if (allowWeakBackend && process.platform === "linux" && WEAK_BACKENDS.has(backendName())) {
      safeStorage.setUsePlainTextEncryption(true);
    }
  }

  status(): VaultStatus {
    const backend = backendName();
    const encrypts = safeStorage.isEncryptionAvailable();
    const strong = !WEAK_BACKENDS.has(backend) || this.allowWeakBackend;
    return { available: encrypts && strong, backend };
  }

  async list(): Promise<SecretMeta[]> {
    const file = await this.load();
    return Object.entries(file.entries)
      .map(([name, entry]) => ({
        name,
        updatedAt: entry.updatedAt,
        managed: isManagedSecret(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Main-process only. Never send the result over IPC; the one exception is
   * the Core session token (`auth.session`), which the renderer must present
   * to Core just like the per-launch token it already holds.
   */
  async get(name: SecretName): Promise<string | undefined> {
    const entry = (await this.load()).entries[name];
    if (!entry) return undefined;
    return safeStorage.decryptString(Buffer.from(entry.cipher, "base64"));
  }

  set(name: SecretName, value: string): Promise<SecretMeta> {
    return this.mutate((file) => {
      this.assertAvailable();
      const updatedAt = new Date().toISOString();
      const cipher = safeStorage.encryptString(value).toString("base64");
      file.entries[name] = { cipher, updatedAt };
      return { name, updatedAt, managed: isManagedSecret(name) };
    });
  }

  delete(name: SecretName): Promise<boolean> {
    return this.mutate((file) => {
      if (!(name in file.entries)) return false;
      delete file.entries[name];
      return true;
    });
  }

  private assertAvailable(): void {
    const { available, backend } = this.status();
    if (!available) {
      throw new AppError("unavailable", `Secure storage is not available (backend: ${backend})`);
    }
  }

  private async load(): Promise<VaultFile> {
    this.file ??= await readVaultFile(this.path);
    return this.file;
  }

  private mutate<T>(change: (file: VaultFile) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const file = structuredClone(await this.load());
      const result = change(file);
      await writeVaultFile(this.path, file);
      this.file = file;
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

function backendName(): string {
  if (process.platform === "darwin") return "keychain";
  if (process.platform === "win32") return "dpapi";
  return safeStorage.getSelectedStorageBackend();
}
