import { sessionTokenSchema } from "@agentic/contracts";
import { describe, expect, it } from "vitest";
import { hashSessionToken, newSessionToken } from "./session-token";

describe("session tokens", () => {
  it("match the contract shape and are unique", () => {
    const a = newSessionToken();
    expect(sessionTokenSchema.parse(a)).toBe(a);
    expect(newSessionToken()).not.toBe(a);
  });

  it("are stored as a SHA-256 hex digest", () => {
    const token = newSessionToken();
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });
});
