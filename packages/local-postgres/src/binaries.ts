import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AppError } from "@agentic/contracts";
import { z } from "zod";

export type PostgresBinaries = { binDir: string; initdb: string; postgres: string };

/** Platforms with a published binary package (`@embedded-postgres/<os>-<arch>`). */
const supported = new Set(["darwin-arm64", "darwin-x64", "linux-x64"]);

const binaryPackageSchema = z.object({ postgres: z.string() });

/**
 * Finds the bundled Postgres binaries. A packaged app passes `binDir`
 * (its resources folder); dev and headless runs use the npm binary package.
 */
export async function resolveBinaries(binDir?: string): Promise<PostgresBinaries> {
  const dir = binDir ?? process.env.AGENTIC_PG_BIN_DIR ?? (await packageBinDir());
  const binaries = { binDir: dir, initdb: join(dir, "initdb"), postgres: join(dir, "postgres") };
  try {
    await access(binaries.initdb);
    await access(binaries.postgres);
  } catch {
    throw new AppError("unavailable", `Postgres binaries not found in ${dir}`);
  }
  return binaries;
}

async function packageBinDir(): Promise<string> {
  const platform = `${process.platform}-${process.arch}`;
  if (!supported.has(platform)) {
    throw new AppError("unavailable", `No bundled Postgres for ${platform}`);
  }
  // A computed specifier keeps bundlers and TypeScript from resolving
  // packages that only exist on other platforms (they are optional).
  const specifier = `@embedded-postgres/${platform}`;
  const mod: unknown = await import(specifier);
  return dirname(binaryPackageSchema.parse(mod).postgres);
}
