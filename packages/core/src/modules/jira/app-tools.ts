import type { AppTool } from "@agentic/chat";
import { jiraJqlSchema, jiraKeySchema } from "@agentic/contracts";
import {
  getJiraIssue,
  type JiraConnection,
  listJiraComments,
  searchJiraIssues,
} from "@agentic/integrations";
import { z } from "zod";

const keySchema = z.object({ key: jiraKeySchema });
const searchSchema = z.object({ jql: jiraJqlSchema });

/** Read-only Jira tools for the chat App: look up issues and search with JQL. */
export function jiraAppTools(conn: JiraConnection): AppTool[] {
  return [
    {
      name: "jira_issue",
      description: "Read a Jira issue with its description and comments.",
      parameters: '{ "key": "ABC-123" }',
      async run(raw, ctx) {
        const { key } = keySchema.parse(raw);
        const api = await conn.api(ctx.workspaceId);
        const [issue, comments] = await Promise.all([
          getJiraIssue(api, key),
          listJiraComments(api, key),
        ]);
        return { issue, comments };
      },
    },
    {
      name: "jira_search",
      description: "Search Jira issues with JQL (up to 20, newest first).",
      parameters: '{ "jql": "project = ABC AND statusCategory != Done" }',
      async run(raw, ctx) {
        const { jql } = searchSchema.parse(raw);
        const page = await searchJiraIssues(await conn.api(ctx.workspaceId), jql, {
          maxResults: 20,
        });
        return page.items.map(({ description: _d, ...issue }) => issue);
      },
    },
  ];
}
