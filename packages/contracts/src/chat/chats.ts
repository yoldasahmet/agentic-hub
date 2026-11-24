import { z } from "zod";
import { identityColorSchema, identityIconSchema } from "../identity";
import { idSchema, isoDateTimeSchema } from "../ids";
import { modelRefSchema } from "../llm/calls";

/** Every chat is a thread of this built-in assistant; the target is data in its state. */
export const CHAT_ASSISTANT_ID = "chat";

/** Open set stored as text (`chats.target_kind`). */
export const chatTargetKinds = ["app", "agent", "workflow"] as const;
export const chatTargetKindSchema = z.enum(chatTargetKinds);
export type ChatTargetKind = z.infer<typeof chatTargetKindSchema>;

/** Who answers: the app's general assistant, or one agent or workflow (its latest version). */
export const chatTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("app") }),
  z.object({ kind: z.literal("agent"), id: idSchema }),
  z.object({ kind: z.literal("workflow"), id: idSchema }),
]);
export type ChatTarget = z.infer<typeof chatTargetSchema>;

/** A target as a message recorded it: which version ran, and how it looked then. */
export const chatTargetRefSchema = z.object({
  kind: chatTargetKindSchema,
  id: idSchema.nullable(),
  version: z.number().int().positive().nullable(),
  name: z.string(),
  color: identityColorSchema.optional(),
  icon: identityIconSchema.optional(),
});
export type ChatTargetRef = z.infer<typeof chatTargetRefSchema>;

export const chatSchema = z.object({
  id: idSchema,
  title: z.string(),
  target: chatTargetSchema,
  /** The App's model, or an override of the agent's own model. Null: the default. */
  model: modelRefSchema.nullable(),
  /** Where CLI providers and terminal mode run. Null: the agent's own policy. */
  workingDir: z.string().nullable(),
  threadId: idSchema,
  archived: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Chat = z.infer<typeof chatSchema>;

const workingDirSchema = z.string().trim().min(1).max(1024);

export const createChatInputSchema = z.object({
  title: z.string().trim().max(200).default(""),
  target: chatTargetSchema.default({ kind: "app" }),
  model: modelRefSchema.nullable().default(null),
  workingDir: workingDirSchema.nullable().default(null),
});
export type CreateChatInput = z.input<typeof createChatInputSchema>;

/** Switching the target mid-chat is allowed: the next message goes to the new one. */
export const updateChatInputSchema = z
  .object({
    title: z.string().trim().max(200),
    target: chatTargetSchema,
    model: modelRefSchema.nullable(),
    workingDir: workingDirSchema.nullable(),
    archived: z.boolean(),
  })
  .partial();
export type UpdateChatInput = z.input<typeof updateChatInputSchema>;

export const chatIdParamSchema = z.object({ chatId: idSchema });
export const chatListQuerySchema = z.object({ archived: z.enum(["0", "1"]).optional() });
export type ChatListQuery = z.infer<typeof chatListQuerySchema>;

/** `GET /chats/:id/git`: the working dir's branch and changed files (context panel). */
export const gitStatusSchema = z.object({
  repo: z.boolean(),
  branch: z.string().nullable(),
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
  changes: z.array(z.object({ path: z.string(), status: z.string() })),
});
export type GitStatus = z.infer<typeof gitStatusSchema>;

/** `GET /chats/:id/git/diff`: uncommitted changes against HEAD, cut for large diffs. */
export const gitDiffSchema = z.object({ diff: z.string(), truncated: z.boolean() });
export type GitDiff = z.infer<typeof gitDiffSchema>;
