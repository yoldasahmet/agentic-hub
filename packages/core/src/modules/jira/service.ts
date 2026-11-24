import {
  type CreateJiraIssueInput,
  createJiraIssueInputSchema,
  type JiraLinkInput,
  type JiraProjectsQuery,
  type JiraSearchQuery,
  jiraLinkInputSchema,
  jiraProjectsQuerySchema,
  jiraSearchQuerySchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import {
  addJiraComment,
  addRemoteLink,
  createJiraIssue,
  getJiraIssue,
  type JiraConnection,
  listIssueTypes,
  listJiraComments,
  listProjects,
  listRemoteLinks,
  listTransitions,
  searchJiraIssues,
  transitionIssue,
} from "@agentic/integrations";

/** The Jira views: projects, JQL search, an issue with its conversation, and its edits. */
export class JiraService {
  constructor(private readonly conn: JiraConnection) {}

  private api(ctx: LocalContext) {
    return this.conn.api(ctx.workspaceId);
  }

  async projects(ctx: LocalContext, raw: JiraProjectsQuery) {
    return listProjects(await this.api(ctx), jiraProjectsQuerySchema.parse(raw));
  }

  async issueTypes(ctx: LocalContext, projectKey: string) {
    return listIssueTypes(await this.api(ctx), projectKey);
  }

  async search(ctx: LocalContext, raw: JiraSearchQuery) {
    const q = jiraSearchQuerySchema.parse(raw);
    return searchJiraIssues(await this.api(ctx), q.jql, q);
  }

  async issue(ctx: LocalContext, key: string) {
    const api = await this.api(ctx);
    const [issue, comments, transitions, links] = await Promise.all([
      getJiraIssue(api, key),
      listJiraComments(api, key),
      listTransitions(api, key),
      listRemoteLinks(api, key),
    ]);
    return { issue, comments, transitions, links };
  }

  async comment(ctx: LocalContext, key: string, body: string) {
    return addJiraComment(await this.api(ctx), key, body);
  }

  async transition(ctx: LocalContext, key: string, transitionId: string) {
    return transitionIssue(await this.api(ctx), key, transitionId);
  }

  async create(ctx: LocalContext, raw: CreateJiraIssueInput) {
    return createJiraIssue(await this.api(ctx), createJiraIssueInputSchema.parse(raw));
  }

  async link(ctx: LocalContext, key: string, raw: JiraLinkInput) {
    return addRemoteLink(await this.api(ctx), key, jiraLinkInputSchema.parse(raw));
  }
}
