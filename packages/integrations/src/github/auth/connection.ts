import { AppError, type GithubTokenSource } from "@agentic/contracts";
import { createGithubApi, type GithubApi } from "../api/client";
import { ghCliToken } from "./gh-cli";

export type GithubConnectionOptions = {
  /** The vault token (PAT or device flow), read fresh on each call. */
  vaultToken(): string | undefined;
  /** `gh auth token`; injectable so headless hosts can turn it off. */
  ghToken?: (host: string) => Promise<string | undefined>;
  baseUrl?: string;
  userAgent: string;
};

/** gh's token is re-read at most this often, so `gh auth logout` takes effect. */
const GH_TTL_MS = 5 * 60_000;

/**
 * The one way Core reaches GitHub. The vault token wins; otherwise an
 * existing `gh auth` login is used. Octokit is rebuilt when the token changes.
 */
export class GithubConnection {
  private gh: { token: string | undefined; at: number } | undefined;
  private cached: { token: string; api: GithubApi } | undefined;

  constructor(private readonly options: GithubConnectionOptions) {}

  get baseUrl(): string | undefined {
    return this.options.baseUrl;
  }

  async token(): Promise<{ token: string; source: GithubTokenSource } | undefined> {
    const vault = this.options.vaultToken();
    if (vault) return { token: vault, source: "vault" };
    const gh = await this.ghToken();
    return gh ? { token: gh, source: "gh" } : undefined;
  }

  async ghToken(): Promise<string | undefined> {
    if (this.gh && Date.now() - this.gh.at < GH_TTL_MS) return this.gh.token;
    const api = new URL(this.baseUrl ?? "https://api.github.com");
    if (api.protocol !== "https:") return undefined;
    const host = api.origin === "https://api.github.com" ? "github.com" : api.host;
    const read = this.options.ghToken ?? ghCliToken;
    this.gh = { token: await read(host), at: Date.now() };
    return this.gh.token;
  }

  /** Forgets the cached gh token, e.g. after the user signed in with gh. */
  refresh(): void {
    this.gh = undefined;
  }

  async api(): Promise<GithubApi> {
    const found = await this.token();
    if (!found) {
      throw new AppError(
        "github.unauthorized",
        "Connect GitHub in Settings → GitHub (token, device sign-in, or `gh auth login`).",
      );
    }
    if (this.cached?.token !== found.token) {
      const api = createGithubApi({
        token: found.token,
        baseUrl: this.options.baseUrl,
        userAgent: this.options.userAgent,
      });
      this.cached = { token: found.token, api };
    }
    return this.cached.api;
  }
}
