import {
  type AgentSpec,
  hasFields,
  type JsonSchema,
  type LlmRequest,
  renderTemplate,
  withoutUiKeywords,
} from "@agentic/contracts";

/**
 * The LLM request for an `llm` agent: the system prompt and the rendered
 * template as the user message. An empty template sends the inputs as JSON,
 * so an agent works before its prompt is written.
 */
export function buildRequest(
  spec: AgentSpec,
  input: Record<string, unknown>,
  model: string,
  cwd: string,
): LlmRequest & { outputSchema?: JsonSchema } {
  const template = spec.prompt.template.trim();
  const content = template
    ? renderTemplate(spec.prompt.template, input)
    : JSON.stringify(input, null, 2);
  return {
    model,
    system: spec.prompt.system.trim() || undefined,
    messages: [{ role: "user", content: content.trim() || "(no input)" }],
    outputSchema: hasFields(spec.outputSchema) ? withoutUiKeywords(spec.outputSchema) : undefined,
    reasoning: spec.runtime.reasoning,
    cwd,
    timeoutMs: spec.runtime.timeoutMs,
  };
}
