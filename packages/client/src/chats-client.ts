import {
  type ChatListQuery,
  type CreateChatInput,
  chatSchema,
  chatTranscriptSchema,
  gitDiffSchema,
  gitStatusSchema,
  type OpenTerminalInput,
  runSchema,
  type SendChatMessageInput,
  terminalSchema,
  type UpdateChatInput,
} from "@agentic/contracts";
import type { AppType } from "@agentic/core";
import type { hc } from "hono/client";
import { z } from "zod";
import { parseResponse } from "./response";

type Api = ReturnType<typeof hc<AppType>>;

/** Chats and their messages (`/chats`), and terminal-mode sessions (`/terminals`). */
export function createChatsClient(api: Api) {
  const chat = api.chats[":chatId"];
  const param = (chatId: string) => ({ param: { chatId } });
  return {
    list: async (query: Partial<ChatListQuery> = {}) =>
      parseResponse(await api.chats.$get({ query }), z.array(chatSchema)),
    get: async (id: string) => parseResponse(await chat.$get(param(id)), chatSchema),
    create: async (json: CreateChatInput) =>
      parseResponse(await api.chats.$post({ json }), chatSchema),
    update: async (id: string, json: UpdateChatInput) =>
      parseResponse(await chat.$patch({ ...param(id), json }), chatSchema),
    remove: async (id: string) =>
      parseResponse(await chat.$delete(param(id)), z.object({ ok: z.boolean() })),
    transcript: async (id: string) =>
      parseResponse(await chat.messages.$get(param(id)), chatTranscriptSchema),
    send: async (id: string, json: SendChatMessageInput) =>
      parseResponse(await chat.messages.$post({ ...param(id), json }), runSchema),
    git: async (id: string) => parseResponse(await chat.git.$get(param(id)), gitStatusSchema),
    gitDiff: async (id: string) =>
      parseResponse(await chat.git.diff.$get(param(id)), gitDiffSchema),
    terminals: {
      list: async () => parseResponse(await api.terminals.$get(), z.array(terminalSchema)),
      open: async (json: OpenTerminalInput) =>
        parseResponse(await api.terminals.$post({ json }), terminalSchema),
      close: async (terminalId: string) =>
        parseResponse(
          await api.terminals[":terminalId"].$delete({ param: { terminalId } }),
          z.object({ ok: z.boolean() }),
        ),
    },
  };
}
