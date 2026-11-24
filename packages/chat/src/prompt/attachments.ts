import { open } from "node:fs/promises";
import type { ChatAttachment, ChatMessage } from "@agentic/contracts";

/** Text files up to this size are inlined into the prompt; larger ones are named by path. */
const INLINE_BYTES = 100_000;
const TEXT_TYPES = /^(text\/|application\/(json|xml|yaml|x-yaml|toml|javascript|typescript|x-sh))/;
const TEXT_EXTENSIONS =
  /\.(md|txt|json|ya?ml|toml|csv|tsv|xml|html?|css|[cm]?[jt]sx?|py|rb|go|rs|java|kt|swift|sh|sql|diff|patch)$/i;

/**
 * A message as prompt text: what the person wrote, then each attachment.
 * Files are read when the turn runs, so the prompt sees their current
 * contents; a file that can't be read is named with the reason.
 */
export async function messageText(message: ChatMessage): Promise<string> {
  const parts = [message.text.trim()];
  for (const attachment of message.attachments) parts.push(await renderAttachment(attachment));
  return parts.filter(Boolean).join("\n\n");
}

async function renderAttachment(attachment: ChatAttachment): Promise<string> {
  if (attachment.kind === "item") {
    const label = attachment.source === "github" ? "GitHub" : "Jira";
    const title = attachment.title ? ` "${attachment.title}"` : "";
    const url = attachment.url ? ` (${attachment.url})` : "";
    return `[${label} item ${attachment.ref}${title}${url}]`;
  }
  const isText = TEXT_TYPES.test(attachment.mediaType) || TEXT_EXTENSIONS.test(attachment.name);
  if (!isText) return `[Attached file: ${attachment.name} at ${attachment.path}]`;
  try {
    const content = await readHead(attachment.path, INLINE_BYTES);
    const cut = content.truncated ? `\n… (truncated; full file at ${attachment.path})` : "";
    return `File ${attachment.name} (${attachment.path}):\n\`\`\`\n${content.text}${cut}\n\`\`\``;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return `[Attached file ${attachment.name} at ${attachment.path} could not be read: ${reason}]`;
  }
}

async function readHead(
  path: string,
  bytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const file = await open(path, "r");
  try {
    const buffer = Buffer.alloc(bytes + 1);
    const { bytesRead } = await file.read(buffer, 0, bytes + 1, 0);
    const truncated = bytesRead > bytes;
    return { text: buffer.subarray(0, Math.min(bytesRead, bytes)).toString("utf8"), truncated };
  } finally {
    await file.close();
  }
}
