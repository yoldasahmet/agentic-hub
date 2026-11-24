import {
  createJiraIssueInputSchema,
  jiraCommentInputSchema,
  jiraConnectionTestSchema,
  jiraKeyParamSchema,
  jiraLinkInputSchema,
  jiraProjectParamSchema,
  jiraProjectsQuerySchema,
  jiraSearchQuerySchema,
  jiraSettingsSchema,
  jiraTransitionInputSchema,
} from "@agentic/contracts";
import { Hono } from "hono";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { JiraAuthService } from "./auth-service";
import type { JiraService } from "./service";

/** `/jira`: connection status and settings, then projects, search, and issues. */
export const jiraRoutes = (jira: JiraService, auth: JiraAuthService) =>
  new Hono<AppEnv>()
    .get("/status", async (c) => c.json(await auth.status(c.var.ctx)))
    .get("/settings", async (c) => c.json(await auth.settingsOf(c.var.ctx)))
    .put("/settings", validate("json", jiraSettingsSchema), async (c) =>
      c.json(await auth.setSettings(c.var.ctx, c.req.valid("json"))),
    )
    .post("/test", validate("json", jiraConnectionTestSchema), async (c) =>
      c.json(await auth.test(c.req.valid("json"))),
    )
    .get("/projects", validate("query", jiraProjectsQuerySchema), async (c) =>
      c.json(await jira.projects(c.var.ctx, c.req.valid("query"))),
    )
    .get(
      "/projects/:projectKey/issue-types",
      validate("param", jiraProjectParamSchema),
      async (c) => c.json(await jira.issueTypes(c.var.ctx, c.req.valid("param").projectKey)),
    )
    .get("/search", validate("query", jiraSearchQuerySchema), async (c) =>
      c.json(await jira.search(c.var.ctx, c.req.valid("query"))),
    )
    .post("/issues", validate("json", createJiraIssueInputSchema), async (c) =>
      c.json(await jira.create(c.var.ctx, c.req.valid("json")), 201),
    )
    .get("/issues/:key", validate("param", jiraKeyParamSchema), async (c) =>
      c.json(await jira.issue(c.var.ctx, c.req.valid("param").key)),
    )
    .post(
      "/issues/:key/comments",
      validate("param", jiraKeyParamSchema),
      validate("json", jiraCommentInputSchema),
      async (c) =>
        c.json(
          await jira.comment(c.var.ctx, c.req.valid("param").key, c.req.valid("json").body),
          201,
        ),
    )
    .post(
      "/issues/:key/transitions",
      validate("param", jiraKeyParamSchema),
      validate("json", jiraTransitionInputSchema),
      async (c) =>
        c.json(
          await jira.transition(
            c.var.ctx,
            c.req.valid("param").key,
            c.req.valid("json").transitionId,
          ),
        ),
    )
    .post(
      "/issues/:key/links",
      validate("param", jiraKeyParamSchema),
      validate("json", jiraLinkInputSchema),
      async (c) =>
        c.json(await jira.link(c.var.ctx, c.req.valid("param").key, c.req.valid("json")), 201),
    );
