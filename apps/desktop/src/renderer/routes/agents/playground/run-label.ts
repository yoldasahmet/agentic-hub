import { parseAgentAssistantId, type Run } from "@agentic/contracts";

/** "Draft" or "v3", plus the start time. */
export function runLabel(run: Run): string {
  const draft = parseAgentAssistantId(run.assistantId)?.draft ?? false;
  const time = new Date(run.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${draft ? "Draft" : `v${run.assistantVersion}`} · ${time}`;
}
