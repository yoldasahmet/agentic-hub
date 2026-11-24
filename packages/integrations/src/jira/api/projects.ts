import type { JiraProject } from "@agentic/contracts";
import { z } from "zod";
import type { JiraApi } from "./client";
import { toUser } from "./mappers";
import { rawProjectSchema, rawUserSchema } from "./raw";

export type ProjectPage = { items: JiraProject[]; startAt: number; hasMore: boolean };

/** Projects the user can browse, optionally filtered by name or key. */
export async function listProjects(
  api: JiraApi,
  opts: { query?: string; startAt?: number } = {},
): Promise<ProjectPage> {
  const startAt = opts.startAt ?? 0;
  const res = await api.request("/project/search", {
    query: { query: opts.query || undefined, startAt, maxResults: 50, orderBy: "name" },
    schema: z.object({
      values: z.array(rawProjectSchema).default([]),
      isLast: z.boolean().default(true),
    }),
  });
  const items = res.values.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    avatarUrl: p.avatarUrls?.["48x48"] ?? null,
  }));
  return { items, startAt, hasMore: !res.isLast };
}

/** Who the token belongs to: the connection test. */
export async function myself(api: JiraApi) {
  const user = toUser(await api.request("/myself", { schema: rawUserSchema }));
  if (!user) throw new Error("Jira returned no user");
  return user;
}
