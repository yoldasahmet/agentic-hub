import type { Chat, ChatMessage, LlmUsage } from "@agentic/contracts";
import { Button, Label, ModelPicker, UsageSummary } from "@agentic/ui";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { showError } from "../../../lib/show-error";
import { providerNames, useModels, useProviders } from "../../settings/providers/queries";
import { TargetSwitch } from "../conversation/target-switch";
import { useTranscript, useUpdateChat } from "../queries";
import { GitStatusCard } from "./git-status-card";
import { WorkingDirInput } from "./working-dir-input";

/** The chat's settings and facts: target, model, working dir, usage and cost, git status. */
export function ContextPanel({ chat }: { chat: Chat }) {
  const models = (useModels().data ?? []).filter((m) => m.enabled);
  const names = providerNames(useProviders().data);
  const messages = useTranscript(chat.id).data?.messages ?? [];
  const update = useUpdateChat();
  const patch = (input: Parameters<typeof update.mutate>[0]["input"]) =>
    update.mutate({ id: chat.id, input }, { onError: (err) => showError(err) });
  const totals = usageOf(messages);
  const modelHint =
    chat.target.kind === "agent"
      ? "The agent's model"
      : chat.target.kind === "workflow"
        ? "Default (reads inputs)"
        : "Default model";

  return (
    <aside aria-label="Chat context" className="grid content-start gap-5 overflow-auto p-4">
      <Section title="Talking to">
        <TargetSwitch value={chat.target} onChange={(target) => patch({ target })} />
      </Section>
      <Section title="Model" htmlFor="chat-model">
        <div className="flex gap-1">
          <ModelPicker
            id="chat-model"
            models={models}
            value={chat.model ?? undefined}
            providerNames={names}
            placeholder={modelHint}
            onChange={(model) => patch({ model })}
          />
          {chat.model && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Use the default"
              onClick={() => patch({ model: null })}
            >
              <RotateCcw aria-hidden />
            </Button>
          )}
        </div>
      </Section>
      <Section title="Working dir" htmlFor="chat-workdir">
        <WorkingDirInput value={chat.workingDir} onChange={(workingDir) => patch({ workingDir })} />
      </Section>
      <Section title="Usage">
        {totals.answers === 0 ? (
          <p className="text-sm text-fg-muted">No answers yet.</p>
        ) : (
          <>
            <UsageSummary
              usage={totals.usage}
              costUsd={totals.costUsd}
              durationMs={totals.durationMs}
            />
            <p className="text-sm text-fg-muted">
              {totals.answers} {totals.answers === 1 ? "answer" : "answers"}
              {totals.unpriced > 0 ? `, ${totals.unpriced} without a known price` : ""}
            </p>
          </>
        )}
      </Section>
      <Section title="Git">
        <GitStatusCard chatId={chat.id} workingDir={chat.workingDir} />
      </Section>
      <Section title="Thread">
        <p className="font-mono text-xs text-fg-subtle" data-selectable>
          {chat.threadId}
        </p>
      </Section>
    </aside>
  );
}

function Section({
  title,
  htmlFor,
  children,
}: {
  title: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-1.5">
      {htmlFor ? (
        <Label htmlFor={htmlFor}>{title}</Label>
      ) : (
        <h2 className="text-sm font-medium">{title}</h2>
      )}
      {children}
    </section>
  );
}

function usageOf(messages: ChatMessage[]) {
  let usage: LlmUsage | undefined;
  let costUsd: number | null = null;
  let durationMs = 0;
  let answers = 0;
  let unpriced = 0;
  for (const { report } of messages) {
    if (!report) continue;
    answers += 1;
    durationMs += report.durationMs;
    if (report.costUsd === null) unpriced += 1;
    else costUsd = (costUsd ?? 0) + report.costUsd;
    if (report.usage) usage = sumUsage(usage, report.usage);
  }
  return { usage, costUsd, durationMs, answers, unpriced };
}

function sumUsage(a: LlmUsage | undefined, b: LlmUsage): LlmUsage {
  if (!a) return b;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: (a.cacheReadTokens ?? 0) + (b.cacheReadTokens ?? 0),
  };
}
