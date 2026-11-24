import type { ChatStreamEvent } from "@agentic/contracts";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

/** Tells the UI which step a turn is on (a `custom` run event). */
export function announce(
  config: LangGraphRunnableConfig,
  step: ChatStreamEvent["step"],
  label: string,
): void {
  const event: ChatStreamEvent = { kind: "chat.step", step, label };
  config.writer?.(event);
}
