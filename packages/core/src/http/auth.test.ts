import { describe, expect, it } from "vitest";
import { isTrustedOrigin, tokenMatches } from "./auth";

describe("tokenMatches", () => {
  it("accepts only the exact token", () => {
    expect(tokenMatches("a".repeat(64), "a".repeat(64))).toBe(true);
    expect(tokenMatches("a".repeat(64), "a".repeat(63))).toBe(false);
    expect(tokenMatches("a".repeat(64), "b".repeat(64))).toBe(false);
    expect(tokenMatches("a".repeat(64), null)).toBe(false);
    expect(tokenMatches("a".repeat(64), "")).toBe(false);
  });
});

describe("isTrustedOrigin", () => {
  it.each([undefined, null, "", "null", "file://", "http://localhost:5173", "http://127.0.0.1"])(
    "trusts %s",
    (origin) => expect(isTrustedOrigin(origin)).toBe(true),
  );

  it.each([
    "https://evil.example",
    "http://localhost.evil.example",
    "http://127.0.0.1.evil.example:80",
    "http://192.168.1.2:5173",
    "chrome-extension://abc",
  ])("refuses %s", (origin) => expect(isTrustedOrigin(origin)).toBe(false));
});
