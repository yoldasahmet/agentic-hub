import { describe, expect, it } from "vitest";
import { dummyHash, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and refuses a wrong one", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(stored).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterY", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("treats Unicode forms of one password alike", async () => {
    const stored = await hashPassword("café au lait");
    expect(await verifyPassword("café au lait", stored)).toBe(true);
  });

  it.each(["", "bcrypt$x", "scrypt$abc$8$1$c2FsdA$aGFzaA", "plain-text"])(
    "never matches a malformed hash (%s)",
    async (stored) => {
      expect(await verifyPassword("anything", stored)).toBe(false);
    },
  );

  it("has a dummy hash for unknown emails that matches nothing", async () => {
    expect(await verifyPassword("", await dummyHash())).toBe(false);
  });
});
