import {
  type CreatePullInput,
  type CreateReviewInput,
  deviceFlowStartSchema,
  deviceFlowStateSchema,
  type GithubListQuery,
  type GithubSettings,
  githubAuthStatusSchema,
  githubCommentSchema,
  githubIssueSchema,
  githubPageSchema,
  githubPullFileSchema,
  githubPullSchema,
  githubRepoSchema,
  githubReviewSchema,
  githubSettingsSchema,
} from "@agentic/contracts";
import type { AppType } from "@agentic/core";
import type { hc } from "hono/client";
import { z } from "zod";
import { parseResponse } from "./response";

type Api = ReturnType<typeof hc<AppType>>;
export type RepoRef = { owner: string; repo: string };

const issueDetailSchema = z.object({
  issue: githubIssueSchema,
  comments: z.array(githubCommentSchema),
});
const pullDetailSchema = z.object({
  pull: githubPullSchema,
  comments: z.array(githubCommentSchema),
  reviews: z.array(githubReviewSchema),
  reviewComments: z.array(githubCommentSchema),
});
export type GithubIssueDetail = z.infer<typeof issueDetailSchema>;
export type GithubPullDetail = z.infer<typeof pullDetailSchema>;

const list = (query: GithubListQuery) =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );

/** `/github`: sign-in status and settings, repos, issues, and pull requests. */
export function createGithubClient(api: Api) {
  const gh = api.github;
  const repo = gh.repos[":owner"][":repo"];
  const issue = repo.issues[":number"];
  const pull = repo.pulls[":number"];
  const item = (ref: RepoRef, number: number) => ({ param: { ...ref, number: String(number) } });
  return {
    status: async () => parseResponse(await gh.status.$get(), githubAuthStatusSchema),
    settings: async () => parseResponse(await gh.settings.$get(), githubSettingsSchema),
    setSettings: async (json: GithubSettings) =>
      parseResponse(await gh.settings.$put({ json }), githubSettingsSchema),
    device: {
      start: async () => parseResponse(await gh.device.$post(), deviceFlowStartSchema),
      state: async (flowId: string) =>
        parseResponse(
          await gh.device[":flowId"].$get({ param: { flowId } }),
          deviceFlowStateSchema,
        ),
      cancel: async (flowId: string) =>
        parseResponse(
          await gh.device[":flowId"].$delete({ param: { flowId } }),
          z.object({ ok: z.literal(true) }),
        ),
    },
    repos: async (page = 1) =>
      parseResponse(
        await gh.repos.$get({ query: { page: String(page) } }),
        githubPageSchema(githubRepoSchema),
      ),
    repo: async (ref: RepoRef) => parseResponse(await repo.$get({ param: ref }), githubRepoSchema),
    issues: async (ref: RepoRef, query: GithubListQuery = {}) =>
      parseResponse(
        await repo.issues.$get({ param: ref, query: list(query) }),
        githubPageSchema(githubIssueSchema),
      ),
    issue: async (ref: RepoRef, number: number) =>
      parseResponse(await issue.$get(item(ref, number)), issueDetailSchema),
    comment: async (ref: RepoRef, number: number, body: string) =>
      parseResponse(
        await issue.comments.$post({ ...item(ref, number), json: { body } }),
        githubCommentSchema,
      ),
    pulls: async (ref: RepoRef, query: GithubListQuery = {}) =>
      parseResponse(
        await repo.pulls.$get({ param: ref, query: list(query) }),
        githubPageSchema(githubPullSchema),
      ),
    pull: async (ref: RepoRef, number: number) =>
      parseResponse(await pull.$get(item(ref, number)), pullDetailSchema),
    pullFiles: async (ref: RepoRef, number: number) =>
      parseResponse(await pull.files.$get(item(ref, number)), z.array(githubPullFileSchema)),
    createPull: async (ref: RepoRef, json: CreatePullInput) =>
      parseResponse(await repo.pulls.$post({ param: ref, json }), githubPullSchema),
    review: async (ref: RepoRef, number: number, json: CreateReviewInput) =>
      parseResponse(await pull.reviews.$post({ ...item(ref, number), json }), githubReviewSchema),
  };
}
