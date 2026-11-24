import {
  type DatabaseSettings,
  databaseSettingsSchema,
  defaultDatabaseSettings,
} from "@agentic/contracts";
import { readJsonFile, writeJsonFile } from "../fs/json-file";

/**
 * Which database to use lives in a file, not in Postgres: it must be known
 * before any connection exists. The remote URL is in the vault instead.
 */
export class DatabaseSettingsFile {
  constructor(private readonly path: string) {}

  read(): Promise<DatabaseSettings> {
    return readJsonFile(this.path, databaseSettingsSchema, () => ({ ...defaultDatabaseSettings }));
  }

  write(settings: DatabaseSettings): Promise<void> {
    return writeJsonFile(this.path, databaseSettingsSchema.parse(settings));
  }
}
