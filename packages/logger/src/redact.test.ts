import { afterEach, describe, expect, it } from "vitest";
import { MASK, redactStrings, redactText, redactValue, setSecretValues } from "./redact";

afterEach(() => setSecretValues([]));

describe("redactText", () => {
  it.each([
    ["an OpenRouter key", `sk-or-v1-${"a".repeat(40)}`],
    ["a GitHub token", `ghp_${"A".repeat(36)}`],
    ["a fine-grained GitHub PAT", `github_pat_${"B".repeat(40)}`],
    ["a GitLab token", `glpat-${"c".repeat(20)}`],
    ["a Slack token", `xoxb-${"1".repeat(10)}-${"a".repeat(10)}`],
    ["an Agentic session token", `ags_${"e".repeat(43)}`],
    ["an Atlassian token", `ATATT3x${"D".repeat(30)}`],
    ["an AWS access key", "AKIAIOSFODNN7EXAMPLE"],
    ["a JWT", `eyJ${"a".repeat(16)}.eyJ${"b".repeat(24)}.${"c".repeat(22)}`],
    ["a bearer header", "Bearer abcdefghijklmnop.qrstuvwxyz"],
    ["a postgres password", "postgres://app:s3cretpass@db.example:5432/agentic"],
    ["a private key", "-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----"],
  ])("masks %s", (_name, secret) => {
    const out = redactText(`before ${secret} after`);
    expect(out).toContain(MASK);
    expect(out).not.toContain(secret);
    expect(out.startsWith("before ")).toBe(true);
  });

  it("masks known vault values and leaves short ones alone", () => {
    setSecretValues(["hunter2-long-value", "abc"]);
    expect(redactText("pw=hunter2-long-value; abc")).toBe(`pw=${MASK}; abc`);
  });

  it("leaves ordinary text alone", () => {
    const text = "Opened PR #12 on main with 3 files and 1200 tokens";
    expect(redactText(text)).toBe(text);
  });
});

describe("redactStrings", () => {
  it("scrubs every string and keeps keys, shape, and other values", () => {
    setSecretValues(["vault-value-123"]);
    const out = redactStrings({
      token: "plain output",
      nested: [{ text: "key vault-value-123" }, 3, null, true],
    });
    expect(out).toEqual({
      token: "plain output",
      nested: [{ text: `key ${MASK}` }, 3, null, true],
    });
  });
});

describe("redactValue", () => {
  it("masks secret-named keys but not token counters", () => {
    expect(redactValue({ apiKey: "x", accessToken: "y", inputTokens: 5 })).toEqual({
      apiKey: MASK,
      accessToken: MASK,
      inputTokens: 5,
    });
  });
});
