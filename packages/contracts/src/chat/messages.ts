import { z } from "zod";
import { agentRunReportSchema } from "../agents/runtime";
import { outputFormatSchema } from "../agents/spec";
import { appErrorSchema } from "../errors";
import { idSchema, isoDateTimeSchema } from "../ids";
import { modelRefSchema } from "../llm/calls";
import { jsonSchemaSchema } from "../llm/request";
import { chatTargetRefSchema, chatTargetSchema } from "./chats";

/**
 * Something sent along with a message. Files are local paths (the app and
 * Core share a machine): small text files are inlined into the prompt,
 * others are named by path so CLI agents can open them. Items reference a
 * GitHub or Jira issue/PR; their content is fetched once those
 * integrations land (P10, P11).
 */
export const chatAttachmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("file"),
    name: z.string().min(1).max(255),
    path: z.string().min(1).max(4096),
    mediaType: z.string().max(200).default("application/octet-stream"),
    size: z.number().int().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal("item"),
    source: z.enum(["github", "jira"]),
    /** `owner/repo#12` or `PROJ-123`. */
    ref: z.string().trim().min(1).max(300),
    url: z.url().optional(),
    title: z.string().max(500).optional(),
  }),
]);
export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

/** A rendered result: the target's output, shown with its format's renderer. */
export const chatOutputSchema = z.object({
  format: outputFormatSchema,
  value: z.record(z.string(), z.unknown()),
  schema: jsonSchemaSchema,
});
export type ChatOutput = z.infer<typeof chatOutputSchema>;

/**
 * One message in a chat thread. Messages live in the thread's LangGraph
 * state (the source of truth), so history, edits, and forks come for free.
 */
export const chatMessageSchema = z.object({
  id: idSchema,
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  createdAt: isoDateTimeSchema,
  attachments: z.array(chatAttachmentSchema).default([]),
  /** Who answered (assistant messages). */
  target: chatTargetRefSchema.optional(),
  /** The inputs an agent or workflow ran with: follow-ups refine them. */
  inputs: z.record(z.string(), z.json()).optional(),
  output: chatOutputSchema.optional(),
  report: agentRunReportSchema.optional(),
  error: appErrorSchema.optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** What each chat run reads besides the message: copied from the chat when it is sent. */
export const chatContextSchema = z.object({
  workspaceId: idSchema,
  target: chatTargetSchema,
  model: modelRefSchema.nullable(),
  workingDir: z.string().nullable(),
});
export type ChatContext = z.infer<typeof chatContextSchema>;

/** `POST /chats/:id/messages`: starts a run, or answers the input card that waits. */
export const sendChatMessageInputSchema = z
  .object({
    text: z.string().max(200_000).default(""),
    attachments: z.array(chatAttachmentSchema).max(20).default([]),
  })
  .refine((m) => m.text.trim() !== "" || m.attachments.length > 0, {
    message: "Write a message or attach something",
  });
export type SendChatMessageInput = z.input<typeof sendChatMessageInputSchema>;

/** The card a chat shows when the target's required inputs are missing (an interrupt). */
export const chatInputsRequestSchema = z.object({
  kind: z.literal("chat.inputs"),
  target: chatTargetRefSchema,
  schema: jsonSchemaSchema,
  values: z.record(z.string(), z.json()),
  issues: z.array(z.string()).default([]),
});
export type ChatInputsRequest = z.infer<typeof chatInputsRequestSchema>;

/** Answers to the inputs card: the filled form, a new message instead, or giving up. */
export const chatInputsAnswerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("inputs"), values: z.record(z.string(), z.json()) }),
  z.object({ kind: z.literal("message"), message: chatMessageSchema }),
  z.object({ kind: z.literal("cancel") }),
]);
export type ChatInputsAnswer = z.infer<typeof chatInputsAnswerSchema>;

/** `GET /chats/:id/messages`: the thread's messages plus what the latest run is doing. */
export const chatTranscriptSchema = z.object({
  messages: z.array(chatMessageSchema),
  /** The latest run of this chat, live or not (null before the first message). */
  runId: idSchema.nullable(),
});
export type ChatTranscript = z.infer<typeof chatTranscriptSchema>;

/** What the chat graph streams with `config.writer` besides agent and workflow events. */
export const chatStreamEventSchema = z.object({
  kind: z.literal("chat.step"),
  step: z.enum(["intake", "ask", "execute", "app", "tool"]),
  label: z.string(),
});
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;
