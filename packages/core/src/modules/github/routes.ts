import {
  createPullInputSchema,
  createReviewInputSchema,
  githubCommentInputSchema,
  githubItemParamSchema,
  githubListQuerySchema,
  githubRepoParamSchema,
  githubSettingsSchema,
} from "@agentic/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { GithubAuthService } from "./auth-service";
import type { GithubService } from "./service";

const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100).default(1) });
const flowParam = z.object({ flowId: z.uuid() });

/** `/github`: auth status and sign-in, then repos, issues, and pull requests. */
export const githubRoutes = (github: GithubService, auth: GithubAuthService) =>
  new Hono<AppEnv>()
    .get("/status", async (c) => c.json(await auth.status(c.var.ctx)))
    .get("/settings", async (c) => c.json(await auth.settingsOf(c.var.ctx)))
    .put("/settings", validate("json", githubSettingsSchema), async (c) =>
      c.json(await auth.setSettings(c.var.ctx, c.req.valid("json"))),
    )
    .post("/device", async (c) => c.json(await auth.startDevice(c.var.ctx), 201))
    .get("/device/:flowId", validate("param", flowParam), (c) =>
      c.json(auth.deviceState(c.req.valid("param").flowId)),
    )
    .delete("/device/:flowId", validate("param", flowParam), (c) => {
      auth.cancelDevice(c.req.valid("param").flowId);
      return c.json({ ok: true as const });
    })
    .get("/repos", validate("query", pageQuery), async (c) =>
      c.json(await github.repos(c.req.valid("query").page)),
    )
    .get("/repos/:owner/:repo", validate("param", githubRepoParamSchema), async (c) =>
      c.json(await github.repo(c.req.valid("param"))),
    )
    .get(
      "/repos/:owner/:repo/issues",
      validate("param", githubRepoParamSchema),
      validate("query", githubListQuerySchema),
      async (c) => c.json(await github.issues(c.req.valid("param"), c.req.valid("query"))),
    )
    .get(
      "/repos/:owner/:repo/issues/:number",
      validate("param", githubItemParamSchema),
      async (c) => {
        const { number, ...ref } = c.req.valid("param");
        return c.json(await github.issue(ref, number));
      },
    )
    .post(
      "/repos/:owner/:repo/issues/:number/comments",
      validate("param", githubItemParamSchema),
      validate("json", githubCommentInputSchema),
      async (c) => {
        const { number, ...ref } = c.req.valid("param");
        return c.json(await github.comment(ref, number, c.req.valid("json").body), 201);
      },
    )
    .get(
      "/repos/:owner/:repo/pulls",
      validate("param", githubRepoParamSchema),
      validate("query", githubListQuerySchema),
      async (c) => c.json(await github.pulls(c.req.valid("param"), c.req.valid("query"))),
    )
    .post(
      "/repos/:owner/:repo/pulls",
      validate("param", githubRepoParamSchema),
      validate("json", createPullInputSchema),
      async (c) =>
        c.json(await github.createPull(c.var.ctx, c.req.valid("param"), c.req.valid("json")), 201),
    )
    .get(
      "/repos/:owner/:repo/pulls/:number",
      validate("param", githubItemParamSchema),
      async (c) => {
        const { number, ...ref } = c.req.valid("param");
        return c.json(await github.pull(ref, number));
      },
    )
    .get(
      "/repos/:owner/:repo/pulls/:number/files",
      validate("param", githubItemParamSchema),
      async (c) => {
        const { number, ...ref } = c.req.valid("param");
        return c.json(await github.pullFiles(ref, number));
      },
    )
    .post(
      "/repos/:owner/:repo/pulls/:number/reviews",
      validate("param", githubItemParamSchema),
      validate("json", createReviewInputSchema),
      async (c) => {
        const { number, ...ref } = c.req.valid("param");
        return c.json(await github.review(ref, number, c.req.valid("json")), 201);
      },
    );
