import { repoFullNameSchema } from "@agentic/contracts";
import { defineTool } from "@agentic/tools";
import { z } from "zod";
import { getIssue, listComments, listIssues } from "../api/issues";
import { getPull, listPullFiles } from "../api/pulls";
import { getRepo, readFile, searchCode, splitRepo } from "../api/repos";
import type { GithubConnection } from "../auth/connection";

const repo = repoFullNameSchema.describe("owner/name");
const number = z.number().int().positive();

/** Read-only GitHub tools: allowed by the default approval policy. */
export function githubReadTools(conn: GithubConnection) {
  return [
    defineTool({
      name: "github.repo.get",
      title: "GitHub repo",
      description: "A repository's description, default branch, and visibility.",
      permission: "read",
      input: z.object({ repo }),
      run: async (i) => getRepo(await conn.api(), splitRepo(i.repo)),
    }),
    defineTool({
      name: "github.issue.get",
      title: "GitHub issue",
      description: "An issue with its body, labels, and comments.",
      permission: "read",
      input: z.object({ repo, number }),
      async run(i) {
        const api = await conn.api();
        const ref = splitRepo(i.repo);
        const [issue, comments] = await Promise.all([
          getIssue(api, ref, i.number),
          listComments(api, ref, i.number),
        ]);
        return { issue, comments };
      },
    }),
    defineTool({
      name: "github.issues.list",
      title: "GitHub issues",
      description:
        "Issues of a repo, newest activity first, optionally by label (comma-separated).",
      permission: "read",
      input: z.object({
        repo,
        state: z.enum(["open", "closed", "all"]).default("open"),
        labels: z.string().max(200).optional(),
      }),
      run: async (i) =>
        listIssues(await conn.api(), splitRepo(i.repo), { state: i.state, labels: i.labels }),
    }),
    defineTool({
      name: "github.pr.get",
      title: "GitHub pull request",
      description: "A pull request with its changed files and their patches.",
      permission: "read",
      input: z.object({ repo, number }),
      async run(i) {
        const api = await conn.api();
        const ref = splitRepo(i.repo);
        const [pull, files] = await Promise.all([
          getPull(api, ref, i.number),
          listPullFiles(api, ref, i.number),
        ]);
        return { pull, files };
      },
    }),
    defineTool({
      name: "github.file.read",
      title: "Read a GitHub file",
      description: "A file's text (or a directory's entries) at a branch, tag, or commit.",
      permission: "read",
      input: z.object({
        repo,
        path: z.string().min(1).max(1024),
        ref: z.string().max(255).optional(),
      }),
      run: async (i) => readFile(await conn.api(), splitRepo(i.repo), i.path, i.ref),
    }),
    defineTool({
      name: "github.code.search",
      title: "Search code",
      description: "GitHub code search in one repo (default branch), e.g. `createApp language:ts`.",
      permission: "read",
      input: z.object({ repo, query: z.string().trim().min(1).max(256) }),
      run: async (i) => searchCode(await conn.api(), i.repo, i.query),
    }),
  ];
}
