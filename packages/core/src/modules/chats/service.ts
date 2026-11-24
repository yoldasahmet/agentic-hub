import type { ChatTargets } from "@agentic/chat";
import { gitDiff, gitStatus } from "@agentic/cli-bridge";
import {
  AppError,
  CHAT_ASSISTANT_ID,
  type Chat,
  type ChatContext,
  type ChatListQuery,
  type ChatMessage,
  type ChatTarget,
  type ChatTranscript,
  type CreateChatInput,
  chatInputsRequestSchema,
  chatMessageSchema,
  createChatInputSchema,
  type GitStatus,
  type JsonValue,
  jsonValueSchema,
  newId,
  type Run,
  type SendChatMessageInput,
  sendChatMessageInputSchema,
  type UpdateChatInput,
  updateChatInputSchema,
} from "@agentic/contracts";
import type { LocalContext } from "@agentic/db";
import type { GraphRuntime } from "@agentic/graph";
import { z } from "zod";
import { toChat } from "./mappers";
import type { ChatRepository } from "./repository";

const TITLE_CHARS = 60;

/**
 * Chats: CRUD over the `chats` index, and messages, which run the `chat`
 * assistant on the chat's thread. The thread's state holds the messages.
 */
export class ChatService {
  constructor(
    private readonly repo: ChatRepository,
    private readonly graph: GraphRuntime,
    private readonly targets: ChatTargets,
    /** The tools' allowlist check (Toolbox.checkDir): a chat's agents run in its folder. */
    private readonly checkDir: (workspaceId: string, dir: string) => Promise<string>,
  ) {}

  async list(ctx: LocalContext, query: ChatListQuery): Promise<Chat[]> {
    return (await this.repo.list(ctx, query.archived === "1")).map(toChat);
  }

  async get(ctx: LocalContext, id: string): Promise<Chat> {
    return toChat(await this.repo.get(ctx, id));
  }

  async create(ctx: LocalContext, raw: CreateChatInput): Promise<Chat> {
    const input = createChatInputSchema.parse(raw);
    await this.checkTarget(ctx, input.target);
    if (input.workingDir) await this.checkDir(ctx.workspaceId, input.workingDir);
    const thread = await this.graph.threads.create(ctx, CHAT_ASSISTANT_ID);
    return toChat(await this.repo.insert(ctx, { ...input, threadId: thread.id }));
  }

  /** A new target applies from the next message on; earlier answers keep theirs. */
  async update(ctx: LocalContext, id: string, raw: UpdateChatInput): Promise<Chat> {
    const patch = updateChatInputSchema.parse(raw);
    if (patch.target) await this.checkTarget(ctx, patch.target);
    if (patch.workingDir) await this.checkDir(ctx.workspaceId, patch.workingDir);
    return toChat(await this.repo.update(ctx, id, patch));
  }

  /** Removes the chat from the list; its thread and runs stay in Runs. */
  async remove(ctx: LocalContext, id: string): Promise<void> {
    await this.repo.remove(ctx, id);
  }

  async transcript(ctx: LocalContext, id: string): Promise<ChatTranscript> {
    const chat = await this.repo.get(ctx, id);
    const [{ state }, [latest]] = await Promise.all([
      this.graph.threads.state(ctx, chat.threadId),
      this.graph.runs.list(ctx, { threadId: chat.threadId, limit: 1 }),
    ]);
    const raw = state?.values.messages;
    const messages = Array.isArray(raw)
      ? raw.flatMap((m) => {
          const parsed = chatMessageSchema.safeParse(m);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
    return { messages, runId: latest?.id ?? null };
  }

  /**
   * Sends a message. Normally it starts a run; while the chat waits on its
   * inputs card, the message answers the card instead (intake reads it).
   */
  async send(ctx: LocalContext, id: string, raw: SendChatMessageInput): Promise<Run> {
    const input = sendChatMessageInputSchema.parse(raw);
    const chat = await this.repo.get(ctx, id);
    const message: ChatMessage = {
      id: newId(),
      role: "user",
      text: input.text,
      attachments: input.attachments,
      createdAt: new Date().toISOString(),
    };
    const [latest] = await this.graph.runs.list(ctx, { threadId: chat.threadId, limit: 1 });
    const run =
      latest?.status === "waiting"
        ? await this.answerCard(ctx, latest, chat.threadId, message)
        : await this.graph.runs.create(ctx, {
            assistantId: CHAT_ASSISTANT_ID,
            threadId: chat.threadId,
            input: json({
              messages: [message],
              context: await this.context(ctx, toChat(chat)),
              turn: null,
            }),
          });
    if (!chat.title) {
      const title = input.text.trim().replace(/\s+/g, " ").slice(0, TITLE_CHARS);
      await this.repo.update(ctx, id, { title: title || "Attachments" });
    } else {
      await this.repo.touch(id);
    }
    return run;
  }

  async git(ctx: LocalContext, id: string): Promise<GitStatus> {
    const chat = await this.repo.get(ctx, id);
    if (!chat.workingDir) return { repo: false, branch: null, ahead: 0, behind: 0, changes: [] };
    return gitStatus(chat.workingDir);
  }

  /** Uncommitted changes of the working dir, for the context panel's diff. */
  async gitDiff(ctx: LocalContext, id: string): Promise<{ diff: string; truncated: boolean }> {
    const chat = await this.repo.get(ctx, id);
    if (!chat.workingDir) return { diff: "", truncated: false };
    return gitDiff(chat.workingDir);
  }

  private async answerCard(
    ctx: LocalContext,
    run: Run,
    threadId: string,
    message: ChatMessage,
  ): Promise<Run> {
    const { state } = await this.graph.threads.state(ctx, threadId);
    const card = state?.interrupts.find((i) => chatInputsRequestSchema.safeParse(i.value).success);
    if (!card) {
      throw new AppError("conflict", "Answer the gate above, or stop the run, before sending");
    }
    return this.graph.runs.resume(ctx, run.id, json({ kind: "message", message }), card.id);
  }

  /** The allowed folders may have changed since the chat picked its folder, so check again. */
  private async context(ctx: LocalContext, chat: Chat): Promise<ChatContext> {
    const { target, model, workingDir } = chat;
    if (workingDir) await this.checkDir(ctx.workspaceId, workingDir);
    return { workspaceId: ctx.workspaceId, target, model, workingDir };
  }

  /** An agent or workflow target must exist in this workspace and be published. */
  private async checkTarget(ctx: LocalContext, target: ChatTarget): Promise<void> {
    if (target.kind !== "app") await this.targets.resolve(target, ctx.workspaceId);
  }
}

/** Run inputs and resume values are JSON; parsing checks it and gives the JSON type. */
function json(value: Record<string, unknown>): Record<string, JsonValue> {
  return z.record(z.string(), jsonValueSchema).parse(value);
}
