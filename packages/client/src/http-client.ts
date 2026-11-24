import {
  assistantSchema,
  type CreateRunInput,
  checkpointSchema,
  type ForkThreadInput,
  type HistoryQuery,
  healthSchema,
  type JsonValue,
  pendingInterruptSchema,
  type RunListQuery,
  runEventPageSchema,
  runSchema,
  SESSION_HEADER,
  type ThreadListQuery,
  threadSchema,
  threadStateSchema,
  type UpdateStateInput,
} from "@agentic/contracts";
import type { AppType } from "@agentic/core";
import { hc } from "hono/client";
import { z } from "zod";
import { createAgentsClient } from "./agents-client";
import { createAuthClient } from "./auth-client";
import { createChatsClient } from "./chats-client";
import { createGithubClient } from "./github-client";
import { createJiraClient } from "./jira-client";
import { createLlmClient } from "./llm-client";
import { parseResponse } from "./response";
import { createToolsClient } from "./tools-client";
import { createWorkflowsClient } from "./workflows-client";

/** `token` is Core's per-launch token; `session` is a signed-in user's session token (P17). */
export type CoreConnection = { url: string; token: string; session?: string };

/** Typed HTTP client over Hono RPC, shared by the renderer and the CLI. */
export function createCoreClient({ url, token, session }: CoreConnection) {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (session) headers[SESSION_HEADER] = session;
  const api = hc<AppType>(url, { headers });
  const q = (query: Record<string, string | number | undefined>) =>
    Object.fromEntries(
      Object.entries(query)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    );

  return {
    health: async () => parseResponse(await api.health.$get(), healthSchema),
    auth: createAuthClient(api),
    assistants: async () => parseResponse(await api.assistants.$get(), z.array(assistantSchema)),
    threads: {
      list: async (query: Partial<ThreadListQuery> = {}) =>
        parseResponse(await api.threads.$get({ query: q(query) }), z.array(threadSchema)),
      state: async (threadId: string) =>
        parseResponse(
          await api.threads[":threadId"].state.$get({ param: { threadId } }),
          threadStateSchema,
        ),
      history: async (threadId: string, query: Partial<HistoryQuery> = {}) =>
        parseResponse(
          await api.threads[":threadId"].history.$get({ param: { threadId }, query: q(query) }),
          z.array(checkpointSchema),
        ),
      updateState: async (threadId: string, json: UpdateStateInput) =>
        parseResponse(
          await api.threads[":threadId"].state.$post({ param: { threadId }, json }),
          threadStateSchema,
        ),
      fork: async (threadId: string, json: ForkThreadInput) =>
        parseResponse(
          await api.threads[":threadId"].fork.$post({ param: { threadId }, json }),
          threadSchema,
        ),
    },
    runs: {
      list: async (query: Partial<RunListQuery> = {}) =>
        parseResponse(await api.runs.$get({ query: q(query) }), z.array(runSchema)),
      create: async (json: CreateRunInput) =>
        parseResponse(await api.runs.$post({ json }), runSchema),
      get: async (runId: string) =>
        parseResponse(await api.runs[":runId"].$get({ param: { runId } }), runSchema),
      wait: async (runId: string, timeoutMs?: number) =>
        parseResponse(
          await api.runs[":runId"].wait.$get({ param: { runId }, query: q({ timeoutMs }) }),
          runSchema,
        ),
      cancel: async (runId: string) =>
        parseResponse(await api.runs[":runId"].cancel.$post({ param: { runId } }), runSchema),
      resume: async (runId: string, resume: JsonValue, interruptId?: string) =>
        parseResponse(
          await api.runs[":runId"].resume.$post({
            param: { runId },
            json: { resume, interruptId },
          }),
          runSchema,
        ),
      events: async (runId: string, after = 0) =>
        parseResponse(
          await api.runs[":runId"].events.$get({ param: { runId }, query: q({ after }) }),
          runEventPageSchema,
        ),
    },
    inbox: async () =>
      parseResponse(await api.inbox.interrupts.$get(), z.array(pendingInterruptSchema)),
    llm: createLlmClient(api),
    agents: createAgentsClient(api),
    workflows: createWorkflowsClient(api),
    chats: createChatsClient(api),
    tools: createToolsClient(api),
    github: createGithubClient(api),
    jira: createJiraClient(api),
  };
}

export type CoreClient = ReturnType<typeof createCoreClient>;
