import { z } from "zod";
import { MarkdownText } from "./markdown-output";

const stepSchema = z.object({
  title: z.string(),
  detail: z.string().optional().catch(undefined),
  successCriteria: z.string().optional().catch(undefined),
});
export type PlanStep = z.infer<typeof stepSchema>;

/** Steps when the value is a list of `{ title, detail?, successCriteria? }`. */
export function planSteps(value: unknown): PlanStep[] | undefined {
  const parsed = z.array(stepSchema).min(1).safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function PlanSteps({ steps }: { steps: PlanStep[] }) {
  return (
    <ol className="grid gap-2">
      {steps.map((step, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional
          key={index}
          className="grid grid-cols-[1.75rem_1fr] gap-x-2 rounded-card border border-border bg-surface p-3"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-accent-tint text-sm font-medium text-accent-ink">
            {index + 1}
          </span>
          <div className="grid gap-1">
            <p className="font-medium">{step.title}</p>
            {step.detail && <MarkdownText text={step.detail} className="text-base" />}
            {step.successCriteria && (
              <p className="text-sm text-fg-muted">Done when: {step.successCriteria}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
