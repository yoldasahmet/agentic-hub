import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "../../csp.config";

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split("; ").map((part) => {
      const [name = "", ...values] = part.split(" ");
      return [name, values];
    }),
  );
}

describe("renderer CSP", () => {
  const prod = directives(contentSecurityPolicy({ dev: false }));

  it("denies by default and allows scripts from the bundle only", () => {
    expect(prod.get("default-src")).toEqual(["'none'"]);
    expect(prod.get("script-src")).toEqual(["'self'"]);
    for (const name of ["object-src", "base-uri", "form-action", "frame-src"]) {
      expect(prod.get(name)).toEqual(["'none'"]);
    }
  });

  it("connects only to the bundle and Core on loopback", () => {
    expect(prod.get("connect-src")).toEqual(["'self'", "http://127.0.0.1:*", "ws://127.0.0.1:*"]);
  });

  it("never allows eval or remote code", () => {
    const all = [...prod.values()].flat();
    expect(all).not.toContain("'unsafe-eval'");
    expect(all.some((v) => v.startsWith("https:") || v === "*")).toBe(false);
  });
});
