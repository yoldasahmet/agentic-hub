import { isoDateTimeSchema, secretNameSchema } from "@agentic/contracts";
import { z } from "zod";
import { readJsonFile, writeJsonFile } from "../fs/json-file";

/** On-disk vault: names in clear text, values encrypted by safeStorage (base64). */
export const vaultFileSchema = z.object({
  version: z.literal(1),
  entries: z.record(
    secretNameSchema,
    z.object({ cipher: z.base64(), updatedAt: isoDateTimeSchema }),
  ),
});
export type VaultFile = z.infer<typeof vaultFileSchema>;

export function readVaultFile(path: string): Promise<VaultFile> {
  return readJsonFile(path, vaultFileSchema, () => ({ version: 1 as const, entries: {} }));
}

export function writeVaultFile(path: string, file: VaultFile): Promise<void> {
  return writeJsonFile(path, file);
}
