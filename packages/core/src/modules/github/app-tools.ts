import type { AppTool } from "@agentic/chat";
import { repoFullNameSchema } from "@agentic/contracts";
import {
  type GithubConnection,
  getIssue,
  getPull,
  listComments,
  listIssues,
  splitRepo,
} from "@agentic/integrations";
import { z } from "zod";

const itemSchema = z.object({ repo: repoFullNameSchema, number: z.number().int().positive() });
const listSchema = z.object({
  repo: repoFullNameSchema,
  state: z.enum(["open", "closed", "all"]).default("open"),
  labels: z.string().max(200).optional(),
});

/** Read-only GitHub tools for the chat App (P8.4): look up issues and pull requests. */
export function githubAppTools(conn: GithubConnection): AppTool[] {
  return [
    {
      name: "github_issue",
      description: "Read a GitHub issue with its comments.",
      parameters: '{ "repo": "owner/name", "number": 12 }',
      async run(raw) {
        const { repo, number } = itemSchema.parse(raw);
        const api = await conn.api();
        const ref = splitRepo(repo);
        const [issue, comments] = await Promise.all([
          getIssue(api, ref, number),
          listComments(api, ref, number),
        ]);
        return { issue, comments };
      },
    },
    {
      name: "github_pull",
      description: "Read a GitHub pull request (title, body, branches, state).",
      parameters: '{ "repo": "owner/name", "number": 34 }',
      async run(raw) {
        const { repo, number } = itemSchema.parse(raw);
        return getPull(await conn.api(), splitRepo(repo), number);
      },
    },
    {
      name: "github_issues",
      description: "List a repo's issues, optionally by state and labels (comma-separated).",
      parameters: '{ "repo": "owner/name", "state": "open|closed|all", "labels": "bug" }',
      async run(raw) {
        const { repo, state, labels } = listSchema.parse(raw);
        const page = await listIssues(await conn.api(), splitRepo(repo), { state, labels });
        return page.items.map(({ body: _body, ...issue }) => issue);
      },
    },
  ];
}
