import {
  type CreateJiraIssueInput,
  type JiraConnectionTest,
  type JiraLinkInput,
  type JiraProjectsQuery,
  type JiraSearchQuery,
  type JiraSettings,
  jiraAuthStatusSchema,
  jiraCommentSchema,
  jiraConnectionResultSchema,
  jiraIssueSchema,
  jiraIssueTypeSchema,
  jiraPageSchema,
  jiraProjectPageSchema,
  jiraProjectSchema,
  jiraRemoteLinkSchema,
  jiraSettingsSchema,
  jiraTransitionSchema,
} from "@agentic/contracts";
import type { AppType } from "@agentic/core";
import type { hc } from "hono/client";
import { z } from "zod";
import { parseResponse } from "./response";

type Api = ReturnType<typeof hc<AppType>>;

const issueDetailSchema = z.object({
  issue: jiraIssueSchema,
  comments: z.array(jiraCommentSchema),
  transitions: z.array(jiraTransitionSchema),
  links: z.array(jiraRemoteLinkSchema),
});
export type JiraIssueDetail = z.infer<typeof issueDetailSchema>;

const query = (q: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(q)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );

/** `/jira`: connection status and settings, projects, JQL search, and issues. */
export function createJiraClient(api: Api) {
  const jira = api.jira;
  const issue = jira.issues[":key"];
  const param = (key: string) => ({ param: { key } });
  return {
    status: async () => parseResponse(await jira.status.$get(), jiraAuthStatusSchema),
    settings: async () => parseResponse(await jira.settings.$get(), jiraSettingsSchema),
    setSettings: async (json: JiraSettings) =>
      parseResponse(await jira.settings.$put({ json }), jiraSettingsSchema),
    test: async (json: JiraConnectionTest) =>
      parseResponse(await jira.test.$post({ json }), jiraConnectionResultSchema),
    projects: async (q: JiraProjectsQuery = {}) =>
      parseResponse(
        await jira.projects.$get({ query: query(q) }),
        jiraProjectPageSchema(jiraProjectSchema),
      ),
    issueTypes: async (projectKey: string) =>
      parseResponse(
        await jira.projects[":projectKey"]["issue-types"].$get({ param: { projectKey } }),
        z.array(jiraIssueTypeSchema),
      ),
    search: async (q: JiraSearchQuery) =>
      parseResponse(
        await jira.search.$get({ query: { ...query(q), jql: q.jql } }),
        jiraPageSchema(jiraIssueSchema),
      ),
    issue: async (key: string) => parseResponse(await issue.$get(param(key)), issueDetailSchema),
    comment: async (key: string, body: string) =>
      parseResponse(
        await issue.comments.$post({ ...param(key), json: { body } }),
        jiraCommentSchema,
      ),
    transition: async (key: string, transitionId: string) =>
      parseResponse(
        await issue.transitions.$post({ ...param(key), json: { transitionId } }),
        jiraIssueSchema,
      ),
    create: async (json: CreateJiraIssueInput) =>
      parseResponse(await jira.issues.$post({ json }), jiraIssueSchema),
    link: async (key: string, json: JiraLinkInput) =>
      parseResponse(await issue.links.$post({ ...param(key), json }), jiraRemoteLinkSchema),
  };
}
