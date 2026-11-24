import { type ChatMessage, newId } from "@agentic/contracts";

type AssistantFields = Omit<ChatMessage, "id" | "role" | "createdAt" | "attachments">;

export function assistantMessage(fields: AssistantFields): ChatMessage {
  return {
    id: newId(),
    role: "assistant",
    createdAt: new Date().toISOString(),
    attachments: [],
    ...fields,
  };
}

export function lastUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
  return messages.findLast((m) => m.role === "user");
}

/** The latest answer from `targetId` that ran with inputs: what a follow-up refines. */
export function lastResultOf(messages: ChatMessage[], targetId: string): ChatMessage | undefined {
  const last = messages.findLast((m) => m.role === "assistant" && m.target);
  return last?.target?.id === targetId && last.inputs ? last : undefined;
}
