import { describe, expect, it, vi } from "vitest";
import { GithubConnection } from "./connection";

describe("GitHub CLI credential scope", () => {
  it.each([
    ["https://api.github.com", "github.com"],
    ["https://git.example.org/api/v3", "git.example.org"],
  ])("looks up the login for %s", async (baseUrl, host) => {
    const ghToken = vi.fn(async () => "fixture");
    const conn = new GithubConnection({
      baseUrl,
      ghToken,
      vaultToken: () => undefined,
      userAgent: "test",
    });
    expect(await conn.token()).toEqual({ source: "gh", token: "fixture" });
    expect(ghToken).toHaveBeenCalledExactlyOnceWith(host);
  });

  it("skips CLI credentials for an HTTP stand-in", async () => {
    const ghToken = vi.fn(async () => "fixture");
    const conn = new GithubConnection({
      baseUrl: "http://127.0.0.1:1234",
      ghToken,
      vaultToken: () => undefined,
      userAgent: "test",
    });
    expect(await conn.token()).toBeUndefined();
    expect(ghToken).not.toHaveBeenCalled();
  });
});
