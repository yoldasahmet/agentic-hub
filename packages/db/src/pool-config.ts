import type { DbConnectionConfig, DbTlsMode } from "@agentic/contracts";
import type { PoolConfig } from "pg";

/** Builds the `pg` pool config. TLS comes from settings, never from URL params. */
export function poolConfig(config: DbConnectionConfig): PoolConfig {
  if (config.mode === "local") {
    const { host, port, user, password, database } = config;
    return { host, port, user, password, database, ssl: false };
  }
  const url = new URL(config.connectionString);
  // `pg` lets sslmode in the URL override the ssl option, so the explicit
  // setting from the UI is the only source.
  for (const param of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(param);
  }
  return { connectionString: url.toString(), ssl: sslOption(config.tls) };
}

function sslOption(mode: DbTlsMode): PoolConfig["ssl"] {
  if (mode === "disable") return false;
  return { rejectUnauthorized: mode === "verify-full" };
}

/** "host:port/database" for status displays. Never includes the user or password. */
export function describeTarget(config: DbConnectionConfig): string {
  if (config.mode === "local") return `${config.host}:${config.port}`;
  try {
    const url = new URL(config.connectionString);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return "remote";
  }
}
