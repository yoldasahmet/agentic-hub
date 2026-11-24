import {
  type ChatMessage,
  type JsonSchema,
  type JsonValue,
  type ModelRef,
  schemaToFields,
  withoutUiKeywords,
} from "@agentic/contracts";
import { callStructured } from "@agentic/llm";
import type { ChatDeps, ChatTargetDefinition } from "../deps";
import { assistantText, clip, conversation } from "../prompt/history";
import { knownInputs, soleTextField } from "./check-inputs";

export type ExtractRequest = {
  target: ChatTargetDefinition;
  messages: ChatMessage[];
  /** The latest user message, already rendered with its attachments. */
  latest: string;
  /** Inputs gathered so far: a previous answer's (refine) or this turn's. */
  current: Record<string, JsonValue>;
  /** The answer a follow-up refines. */
  previous?: ChatMessage;
  model: ModelRef | undefined;
  cwd: string;
  signal?: AbortSignal;
};

/**
 * Reads a target's inputs from the conversation. A first message to a
 * target with one text field becomes that field as is (no model call).
 * Otherwise the model fills what the person gave or clearly implied and
 * refines current inputs on follow-ups. Without a model, or when the
 * call fails, the current inputs stay and the inputs card asks.
 */
export async function extractInputs(
  req: ExtractRequest,
  deps: ChatDeps,
): Promise<Record<string, JsonValue>> {
  const schema = req.target.inputSchema;
  const fields = schemaToFields(schema);
  if (fields.length === 0) return {};
  const sole = soleTextField(schema);
  const fresh = Object.keys(req.current).length === 0;
  if (sole && (fresh || !req.model)) return { [sole]: req.latest };
  if (!req.model) return req.current;

  const provider = deps.providers.get(req.model.providerId);
  const outcome = await callStructured(
    provider,
    {
      model: req.model.model,
      system: instructions(req.target),
      messages: [{ role: "user", content: await prompt(req) }],
      outputSchema: optionalFields(schema),
      cwd: req.cwd,
    },
    { retries: 1, signal: req.signal, pricing: await deps.pricing(req.model) },
  );
  if (!outcome.ok) return req.current;
  return { ...req.current, ...knownInputs(schema, outcome.structured) };
}

function instructions(target: ChatTargetDefinition): string {
  const about = target.description ? ` (${target.description})` : "";
  return [
    `You fill in the inputs of "${target.ref.name}"${about} from a chat.`,
    "Reply with a JSON object holding only the fields the person gave or clearly implied; leave out anything you would have to guess.",
    "When current inputs are given, the latest message refines them: return the fields it changes. For free-text fields, write the complete new text with the requested changes folded in.",
  ].join("\n");
}

async function prompt(req: ExtractRequest): Promise<string> {
  const fields = schemaToFields(req.target.inputSchema).map(
    (f) =>
      `- ${f.name}${f.required ? "*" : ""} (${f.type})${f.description ? `: ${f.description}` : ""}`,
  );
  const history = (await conversation(req.messages.slice(0, -1)))
    .slice(-10)
    .map((m) => `${m.role}: ${clip(m.content, 2000)}`);
  return [
    `Input fields (* = required):\n${fields.join("\n")}`,
    `Current inputs: ${Object.keys(req.current).length ? JSON.stringify(req.current) : "(none)"}`,
    req.previous ? `Previous result:\n${assistantText(req.previous)}` : "",
    history.length ? `Conversation so far:\n${history.join("\n")}` : "",
    `Latest message:\n${req.latest}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The input schema with nothing required, so the model can return only what it found. */
function optionalFields(schema: JsonSchema): JsonSchema {
  const { required: _required, ...rest } = withoutUiKeywords(schema);
  return rest;
}
