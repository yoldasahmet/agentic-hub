import type {
  LlmEvent,
  LlmRequest,
  ProviderCapabilities,
  ProviderStatus,
} from "@agentic/contracts";
import type { LlmProvider } from "@agentic/llm";

/** What the fake answers: text, events, or a function of the request. */
export type FakeReply = string | LlmEvent[] | ((req: LlmRequest) => string | LlmEvent[]);

export type FakeProvider = LlmProvider & { requests: LlmRequest[] };

/**
 * A scripted provider: each call takes the next reply (the last one
 * repeats), so tests drive agents without a CLI or network.
 */
export function fakeProvider(replies: FakeReply[], id = "fake"): FakeProvider {
  const requests: LlmRequest[] = [];
  const capabilities: ProviderCapabilities = {
    streaming: true,
    tools: false,
    structuredOutput: "extract",
    reasoning: false,
    images: false,
    mcp: false,
  };
  const status: ProviderStatus = {
    id,
    name: "Fake",
    transport: "api",
    capabilities,
    installed: true,
    signedIn: true,
  };
  return {
    id,
    name: "Fake",
    transport: "api",
    capabilities,
    requests,
    detect: async () => status,
    listModels: async () => [],
    async *stream(req: LlmRequest) {
      requests.push(req);
      const reply = replies[Math.min(requests.length - 1, replies.length - 1)] ?? "";
      const value = typeof reply === "function" ? reply(req) : reply;
      if (typeof value === "string") {
        yield { type: "text", delta: value };
        yield { type: "done" };
      } else {
        yield* value;
      }
    },
  };
}
