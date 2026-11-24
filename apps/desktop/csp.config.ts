/**
 * The renderer's Content-Security-Policy. Production allows only bundled
 * code and the local Core on 127.0.0.1 (Phase 4). Dev adds the Vite server.
 */
export function contentSecurityPolicy({ dev }: { dev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'none'"],
    "script-src": dev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
    // Radix positions popovers with inline style attributes.
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'", "data:"],
    "img-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "http://127.0.0.1:*",
      "ws://127.0.0.1:*",
      ...(dev ? ["http://localhost:*", "ws://localhost:*"] : []),
    ],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
    "frame-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
