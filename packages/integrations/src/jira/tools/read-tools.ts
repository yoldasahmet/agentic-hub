import { jiraJqlSchema, jiraKeySchema } from "@agentic/contracts";
import { defineTool } from "@agentic/tools";
import { z } from "zod";
import { listComments, listRemoteLinks } from "../api/comments";
import { getIssue, listTransitions, searchIssues } from "../api/issues";
import { listProjects } from "../api/projects";
import type { JiraConnection } from "../auth/connection";

const key = jiraKeySchema.describe("Issue key, e.g. ABC-123");

/** Read-only Jira tools: allowed by the default approval policy. */
export function jiraReadTools(conn: JiraConnection) {
  return [
    defineTool({
      name: "jira.issue.get",
      title: "Jira issue",
      description:
        "An issue with its Markdown description, comments, available transitions, and linked PRs.",
      permission: "read",
      input: z.object({ key }),
      async run(i, ctx) {
        const api = await conn.api(ctx.workspaceId);
        const [issue, comments, transitions, links] = await Promise.all([
          getIssue(api, i.key),
          listComments(api, i.key),
          listTransitions(api, i.key),
          listRemoteLinks(api, i.key),
        ]);
        return { issue, comments, transitions, links };
      },
    }),
    defineTool({
      name: "jira.search",
      title: "Search Jira",
      description: 'Issues matching a JQL query, e.g. `project = ABC AND status = "To Do"`.',
      permission: "read",
      input: z.object({
        jql: jiraJqlSchema,
        maxResults: z.number().int().min(1).max(50).default(20),
      }),
      async run(i, ctx) {
        const page = await searchIssues(await conn.api(ctx.workspaceId), i.jql, {
          maxResults: i.maxResults,
        });
        return page.items.map(({ description, ...issue }) => ({
          ...issue,
          description: description.slice(0, 500),
        }));
      },
    }),
    defineTool({
      name: "jira.projects.list",
      title: "Jira projects",
      description: "Projects you can browse, optionally filtered by name or key.",
      permission: "read",
      input: z.object({ query: z.string().max(100).optional() }),
      run: async (i, ctx) => (await listProjects(await conn.api(ctx.workspaceId), i)).items,
    }),
  ];
}
