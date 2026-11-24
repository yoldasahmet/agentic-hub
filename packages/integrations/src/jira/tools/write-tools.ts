import { AppError, jiraKeySchema, jiraProjectKeySchema } from "@agentic/contracts";
import { defineTool } from "@agentic/tools";
import { z } from "zod";
import type { JiraApi } from "../api/client";
import { addComment, addRemoteLink } from "../api/comments";
import { createIssue, listIssueTypes, transitionByName } from "../api/issues";
import type { JiraConnection } from "../auth/connection";

const key = jiraKeySchema.describe("Issue key, e.g. ABC-123");
const labels = z.array(z.string().trim().min(1).max(255).regex(/^\S+$/)).max(20).default([]);

/** The project's sub-task type when none is named ("Sub-task" or "Subtask", by site). */
async function subtaskType(api: JiraApi, projectKey: string, named?: string): Promise<string> {
  if (named) return named;
  const found = (await listIssueTypes(api, projectKey)).find((t) => t.subtask);
  if (!found) throw new AppError("conflict", `Project ${projectKey} has no sub-task type`);
  return found.name;
}

/**
 * Jira tools with side effects. All are `write`, so the default policy
 * asks a person before an agent may use them.
 */
export function jiraWriteTools(conn: JiraConnection) {
  return [
    defineTool({
      name: "jira.comment",
      title: "Comment on Jira",
      description: "Adds a comment (Markdown) to an issue.",
      permission: "write",
      input: z.object({ key, body: z.string().trim().min(1).max(32_768) }),
      run: async (i, ctx) => addComment(await conn.api(ctx.workspaceId), i.key, i.body),
    }),
    defineTool({
      name: "jira.transition",
      title: "Move a Jira issue",
      description:
        'Moves an issue through its workflow, by transition name, target status, or id (e.g. "In Progress").',
      permission: "write",
      input: z.object({ key, transition: z.string().trim().min(1).max(100) }),
      run: async (i, ctx) => transitionByName(await conn.api(ctx.workspaceId), i.key, i.transition),
    }),
    defineTool({
      name: "jira.issue.create",
      title: "Create a Jira issue",
      description: "Creates an issue (Markdown description) in a project.",
      permission: "write",
      input: z.object({
        projectKey: jiraProjectKeySchema,
        issueType: z.string().trim().min(1).max(64).default("Task"),
        summary: z.string().trim().min(1).max(255),
        description: z.string().max(32_768).default(""),
        labels,
      }),
      run: async (i, ctx) => createIssue(await conn.api(ctx.workspaceId), i),
    }),
    defineTool({
      name: "jira.subtask.create",
      title: "Create Jira sub-tasks",
      description: "Creates sub-tasks under an issue, one per item.",
      permission: "write",
      input: z.object({
        parentKey: key,
        issueType: z.string().trim().min(1).max(64).optional(),
        subtasks: z
          .array(
            z.object({
              summary: z.string().trim().min(1).max(255),
              description: z.string().max(32_768).default(""),
            }),
          )
          .min(1)
          .max(20),
      }),
      async run(i, ctx) {
        const api = await conn.api(ctx.workspaceId);
        const projectKey = i.parentKey.replace(/-\d+$/, "");
        const issueType = await subtaskType(api, projectKey, i.issueType);
        const created = [];
        for (const sub of i.subtasks) {
          created.push(
            await createIssue(api, {
              ...sub,
              projectKey,
              issueType,
              parentKey: i.parentKey,
              labels: [],
            }),
          );
        }
        return created.map((c) => ({ key: c.key, summary: c.summary, url: c.url }));
      },
    }),
    defineTool({
      name: "jira.link",
      title: "Link to a Jira issue",
      description:
        "Adds a web link (e.g. a pull request URL) to an issue; linking a URL twice updates it.",
      permission: "write",
      input: z.object({ key, url: z.url(), title: z.string().trim().min(1).max(255) }),
      run: async (i, ctx) =>
        addRemoteLink(await conn.api(ctx.workspaceId), i.key, { url: i.url, title: i.title }),
    }),
  ];
}
