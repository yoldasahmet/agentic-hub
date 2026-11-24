/**
 * Variables every CLI may see: locale, home, temp, proxy and CA settings.
 * Everything else (the app's own AGENTIC_* config, Electron internals,
 * unrelated tokens) is dropped unless the CLI's spec passes its prefix.
 */
const BASE_KEYS = new Set([
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TMPDIR",
  "TZ",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_STATE_HOME",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "NO_PROXY",
  "https_proxy",
  "http_proxy",
  "no_proxy",
]);

export type ChildEnvOptions = {
  /** Prefixes the CLI needs for its own auth/config, e.g. "ANTHROPIC_". */
  passPrefixes?: readonly string[];
  /** The PATH to search; GUI apps on macOS get a minimal one (see shell-path). */
  path?: string;
  /** Explicit additions from the caller. They win over inherited values. */
  extra?: Record<string, string>;
};

export function buildChildEnv(
  source: NodeJS.ProcessEnv,
  { passPrefixes = [], path, extra = {} }: ChildEnvOptions,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || key.startsWith("AGENTIC_")) continue;
    if (BASE_KEYS.has(key) || passPrefixes.some((prefix) => key.startsWith(prefix))) {
      env[key] = value;
    }
  }
  const searchPath = path ?? source.PATH;
  if (searchPath) env.PATH = searchPath;
  // Keeps CLIs from drawing spinners or colors into a stream we parse.
  env.NO_COLOR = "1";
  env.CI = "1";
  return { ...env, ...extra };
}
