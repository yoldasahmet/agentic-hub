import type { JiraComment, JiraRemoteLink } from "@agentic/contracts";
import { z } from "zod";
import { markdownToAdf } from "../adf/from-markdown";
import type { JiraApi } from "./client";
import { toComment } from "./mappers";
import { rawCommentSchema, rawRemoteLinkSchema } from "./raw";

const path = (key: string) => `/issue/${encodeURIComponent(key)}`;

/** The newest 100 comments, oldest first. */
export async function listComments(api: JiraApi, key: string): Promise<JiraComment[]> {
  const res = await api.request(`${path(key)}/comment`, {
    query: { orderBy: "-created", maxResults: 100 },
    schema: z.object({ comments: z.array(rawCommentSchema).default([]) }),
  });
  return res.comments.map(toComment).reverse();
}

export async function addComment(
  api: JiraApi,
  key: string,
  markdown: string,
): Promise<JiraComment> {
  const raw = await api.request(`${path(key)}/comment`, {
    method: "POST",
    body: { body: markdownToAdf(markdown) },
    schema: rawCommentSchema,
  });
  return toComment(raw);
}

export async function listRemoteLinks(api: JiraApi, key: string): Promise<JiraRemoteLink[]> {
  const rows = await api.request(`${path(key)}/remotelink`, {
    schema: z.array(rawRemoteLinkSchema),
  });
  return rows.map((r) => ({ id: r.id, url: r.object.url, title: r.object.title }));
}

/**
 * Adds a web link (e.g. a pull request). The URL is the global id, so
 * linking the same PR twice updates the link instead of adding another.
 */
export async function addRemoteLink(
  api: JiraApi,
  key: string,
  link: { url: string; title: string },
): Promise<JiraRemoteLink> {
  const res = await api.request(`${path(key)}/remotelink`, {
    method: "POST",
    body: { globalId: link.url, object: { url: link.url, title: link.title } },
    schema: z.object({ id: z.number().int() }),
  });
  return { id: res.id, ...link };
}
