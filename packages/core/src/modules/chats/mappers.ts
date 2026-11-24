import { type Chat, type ChatTarget, chatTargetSchema, modelRefSchema } from "@agentic/contracts";
import type { ChatRow } from "./repository";

export function toChat(row: ChatRow): Chat {
  return {
    id: row.id,
    title: row.title,
    target: targetOf(row),
    model: modelRefSchema.nullable().catch(null).parse(row.model),
    workingDir: row.workingDir,
    threadId: row.threadId,
    archived: row.archivedAt !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A target whose row no longer parses (an unknown kind) falls back to the App. */
function targetOf(row: ChatRow): ChatTarget {
  const parsed = chatTargetSchema.safeParse({
    kind: row.targetKind,
    id: row.targetId ?? undefined,
  });
  return parsed.success ? parsed.data : { kind: "app" };
}
