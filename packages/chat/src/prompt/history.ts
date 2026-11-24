import type { ChatMessage, LlmMessage } from "@agentic/contracts";
import { messageText } from "./attachments";

/** How much of the conversation a model call sees. */
const MAX_MESSAGES = 30;
const MAX_RESULT_CHARS = 4000;

/** The conversation as LLM messages; results from agents and workflows become short JSON. */
export async function conversation(messages: ChatMessage[]): Promise<LlmMessage[]> {
  const recent = messages.slice(-MAX_MESSAGES);
  const out: LlmMessage[] = [];
  for (const message of recent) {
    const content = message.role === "user" ? await messageText(message) : assistantText(message);
    if (content.trim()) out.push({ role: message.role, content });
  }
  return out;
}

/** What an answer said, as plain text for a later prompt. */
export function assistantText(message: ChatMessage): string {
  const parts: string[] = [];
  if (message.text.trim()) parts.push(message.text.trim());
  if (message.output) {
    const who = message.target ? `${message.target.name} answered` : "Result";
    parts.push(`${who}:\n${clip(JSON.stringify(message.output.value, null, 2))}`);
  }
  if (message.error) parts.push(`(Failed: ${message.error.message})`);
  return parts.join("\n\n");
}

export function clip(text: string, max = MAX_RESULT_CHARS): string {
  return text.length > max
    ? `${text.slice(0, max)}\n… (${text.length - max} more characters)`
    : text;
}
