import { AppError } from "@agentic/contracts";
import { describe, expect, it } from "vitest";
import { SignInLimiter } from "./rate-limit";

describe("SignInLimiter", () => {
  it("locks an email after too many failures, until the window passes", () => {
    let now = 0;
    const limiter = new SignInLimiter(3, 1000, () => now);
    for (let i = 0; i < 3; i++) {
      limiter.check("a@example.com");
      limiter.fail("a@example.com");
    }
    expect(() => limiter.check("a@example.com")).toThrow(AppError);
    expect(() => limiter.check("b@example.com")).not.toThrow();
    now = 1000;
    expect(() => limiter.check("a@example.com")).not.toThrow();
  });

  it("forgets failures after a successful sign-in", () => {
    const limiter = new SignInLimiter(2, 1000, () => 0);
    limiter.fail("a@example.com");
    limiter.succeed("a@example.com");
    limiter.fail("a@example.com");
    expect(() => limiter.check("a@example.com")).not.toThrow();
  });
});
