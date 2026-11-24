import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";

const GithubOctokit = Octokit.plugin(throttling, retry);
export type GithubApi = InstanceType<typeof GithubOctokit>;

export type GithubApiOptions = {
  token: string;
  /** api.github.com unless a stand-in or GitHub Enterprise is configured. */
  baseUrl?: string;
  userAgent: string;
};

/** Primary limits wait when GitHub says how long (up to a minute), twice at most. */
const MAX_RATE_LIMIT_WAIT_S = 60;

/**
 * Octokit with rate-limit backoff (throttling) and retries of transient
 * 5xx errors. Waits beyond a minute fail fast instead of stalling a run.
 */
export function createGithubApi({ token, baseUrl, userAgent }: GithubApiOptions): GithubApi {
  return new GithubOctokit({
    auth: token,
    baseUrl,
    userAgent,
    throttle: {
      onRateLimit: (retryAfter, _options, _octokit, retryCount) =>
        retryCount < 2 && retryAfter <= MAX_RATE_LIMIT_WAIT_S,
      onSecondaryRateLimit: (retryAfter, _options, _octokit, retryCount) =>
        retryCount < 1 && retryAfter <= MAX_RATE_LIMIT_WAIT_S,
    },
    retry: { retries: 2 },
  });
}

/** GitHub paginates with a Link header; `rel="next"` means another page exists. */
export function hasNextPage(headers: { link?: string }): boolean {
  return /rel="next"/.test(headers.link ?? "");
}
