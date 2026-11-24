import {
  chatIdParamSchema,
  chatListQuerySchema,
  createChatInputSchema,
  sendChatMessageInputSchema,
  updateChatInputSchema,
} from "@agentic/contracts";
import { Hono } from "hono";
import type { AppEnv } from "../../http/env";
import { validate } from "../../http/validate";
import type { ChatService } from "./service";

/** `/chats`: CRUD, the transcript, sending messages, and the working dir's git status. */
export const chatRoutes = (chats: ChatService) =>
  new Hono<AppEnv>()
    .get("/", validate("query", chatListQuerySchema), async (c) =>
      c.json(await chats.list(c.var.ctx, c.req.valid("query"))),
    )
    .post("/", validate("json", createChatInputSchema), async (c) =>
      c.json(await chats.create(c.var.ctx, c.req.valid("json")), 201),
    )
    .get("/:chatId", validate("param", chatIdParamSchema), async (c) =>
      c.json(await chats.get(c.var.ctx, c.req.valid("param").chatId)),
    )
    .patch(
      "/:chatId",
      validate("param", chatIdParamSchema),
      validate("json", updateChatInputSchema),
      async (c) =>
        c.json(await chats.update(c.var.ctx, c.req.valid("param").chatId, c.req.valid("json"))),
    )
    .delete("/:chatId", validate("param", chatIdParamSchema), async (c) => {
      await chats.remove(c.var.ctx, c.req.valid("param").chatId);
      return c.json({ ok: true });
    })
    .get("/:chatId/messages", validate("param", chatIdParamSchema), async (c) =>
      c.json(await chats.transcript(c.var.ctx, c.req.valid("param").chatId)),
    )
    .post(
      "/:chatId/messages",
      validate("param", chatIdParamSchema),
      validate("json", sendChatMessageInputSchema),
      async (c) =>
        c.json(await chats.send(c.var.ctx, c.req.valid("param").chatId, c.req.valid("json")), 201),
    )
    .get("/:chatId/git", validate("param", chatIdParamSchema), async (c) =>
      c.json(await chats.git(c.var.ctx, c.req.valid("param").chatId)),
    )
    .get("/:chatId/git/diff", validate("param", chatIdParamSchema), async (c) =>
      c.json(await chats.gitDiff(c.var.ctx, c.req.valid("param").chatId)),
    );
