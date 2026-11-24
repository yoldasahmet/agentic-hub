import {
  AppError,
  type JiraIssue,
  type JiraIssueType,
  type JiraTransition,
} from "@agentic/contracts";
import { z } from "zod";
import { markdownToAdf } from "../adf/from-markdown";
import type { JiraApi } from "./client";
import { toIssue, toStatus } from "./mappers";
import { ISSUE_FIELDS, rawIssueSchema, rawIssueTypeSchema, rawTransitionSchema } from "./raw";

export type JiraPage<T> = { items: T[]; nextPageToken: string | null };

const searchSchema = z.object({
  issues: z.array(rawIssueSchema).default([]),
  nextPageToken: z.string().nullish(),
});

/** JQL search through the enhanced endpoint (token paging; the offset one is deprecated). */
export async function searchIssues(
  api: JiraApi,
  jql: string,
  opts: { pageToken?: string; maxResults?: number } = {},
): Promise<JiraPage<JiraIssue>> {
  const res = await api.request("/search/jql", {
    method: "POST",
    body: {
      jql,
      fields: ISSUE_FIELDS,
      maxResults: opts.maxResults ?? 30,
      nextPageToken: opts.pageToken,
    },
    schema: searchSchema,
  });
  return {
    items: res.issues.map((i) => toIssue(i, (k) => api.browseUrl(k))),
    nextPageToken: res.nextPageToken ?? null,
  };
}

export async function getIssue(api: JiraApi, key: string): Promise<JiraIssue> {
  const raw = await api.request(`/issue/${encodeURIComponent(key)}`, {
    query: { fields: ISSUE_FIELDS.join(",") },
    schema: rawIssueSchema,
  });
  return toIssue(raw, (k) => api.browseUrl(k));
}

export async function listTransitions(api: JiraApi, key: string): Promise<JiraTransition[]> {
  const res = await api.request(`/issue/${encodeURIComponent(key)}/transitions`, {
    schema: z.object({ transitions: z.array(rawTransitionSchema).default([]) }),
  });
  return res.transitions.map((t) => ({ id: t.id, name: t.name, to: toStatus(t.to) }));
}

export async function transitionIssue(api: JiraApi, key: string, transitionId: string) {
  await api.request(`/issue/${encodeURIComponent(key)}/transitions`, {
    method: "POST",
    body: { transition: { id: transitionId } },
    schema: z.unknown(),
  });
  return getIssue(api, key);
}

/** Finds a transition by id or by its name or target status (case-insensitive). */
export async function transitionByName(api: JiraApi, key: string, nameOrId: string) {
  const all = await listTransitions(api, key);
  const wanted = nameOrId.trim().toLowerCase();
  const found = all.find(
    (t) =>
      t.id === nameOrId || t.name.toLowerCase() === wanted || t.to.name.toLowerCase() === wanted,
  );
  if (!found) {
    const names = all.map((t) => `${t.name} → ${t.to.name}`).join(", ");
    throw new AppError(
      "not_found",
      `No transition "${nameOrId}" on ${key}. Available: ${names || "none"}`,
    );
  }
  return transitionIssue(api, key, found.id);
}

export type NewIssue = {
  projectKey: string;
  issueType: string;
  summary: string;
  description: string;
  parentKey?: string;
  labels: string[];
};

export async function createIssue(api: JiraApi, input: NewIssue): Promise<JiraIssue> {
  const fields: Record<string, unknown> = {
    project: { key: input.projectKey },
    issuetype: { name: input.issueType },
    summary: input.summary,
    labels: input.labels,
  };
  if (input.description.trim()) fields.description = markdownToAdf(input.description);
  if (input.parentKey) fields.parent = { key: input.parentKey };
  const created = await api.request("/issue", {
    method: "POST",
    body: { fields },
    schema: z.object({ key: z.string() }),
  });
  return getIssue(api, created.key);
}

/** The issue types a project offers when creating (sub-task types included). */
export async function listIssueTypes(api: JiraApi, projectKey: string): Promise<JiraIssueType[]> {
  const res = await api.request(`/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`, {
    schema: z.object({
      issueTypes: z.array(rawIssueTypeSchema).optional(),
      values: z.array(rawIssueTypeSchema).optional(),
    }),
  });
  return res.issueTypes ?? res.values ?? [];
}
