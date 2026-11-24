import type { LlmRequest } from "@agentic/contracts";

/**
 * CLIs take one prompt per run, so a conversation is flattened into a
 * transcript. The system prompt is prepended for CLIs without a flag for it.
 */
export function renderPrompt(req: LlmRequest, { withSystem }: { withSystem: boolean }): string {
  const [first, ...rest] = req.messages;
  const body =
    rest.length === 0 && first?.role === "user"
      ? first.content
      : req.messages
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n\n");
  return withSystem && req.system ? `${req.system}\n\n${body}` : body;
}
