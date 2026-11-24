import type { LlmRequest } from "@agentic/contracts";

/** The OpenAI-compatible chat completions body OpenRouter takes. */
export function chatCompletionBody(req: LlmRequest): Record<string, unknown> {
  const messages = [
    ...(req.system ? [{ role: "system", content: req.system }] : []),
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const body: Record<string, unknown> = {
    model: req.model,
    messages,
    stream: true,
    usage: { include: true },
  };
  if (req.maxTokens) body.max_tokens = req.maxTokens;
  if (req.reasoning) body.reasoning = { effort: req.reasoning };
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
  }
  if (req.outputSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "output", strict: true, schema: req.outputSchema },
    };
  }
  return body;
}
