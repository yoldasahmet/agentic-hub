import { Badge, type BadgeProps, cn } from "@agentic/ui";
import { CircleCheck, CircleDashed, CircleX, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type StepState = "done" | "todo" | "checking" | "problem";

const looks: Record<StepState, { label: string; icon: LucideIcon; tone: BadgeProps["tone"] }> = {
  done: { label: "Done", icon: CircleCheck, tone: "success" },
  todo: { label: "Not set up", icon: CircleDashed, tone: "neutral" },
  checking: { label: "Checking", icon: LoaderCircle, tone: "info" },
  problem: { label: "Needs attention", icon: CircleX, tone: "danger" },
};

type Props = {
  number: number;
  title: string;
  description: string;
  state: StepState;
  optional?: boolean;
  children?: ReactNode;
};

/** One first-run step: number, title, state (icon + label), and its inline controls. */
export function SetupStep({ number, title, description, state, optional, children }: Props) {
  const { label, icon: Icon, tone } = looks[state];
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-3 rounded-card border border-border bg-surface p-4 shadow-1">
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-full bg-surface-sunken text-sm font-medium text-fg-muted"
      >
        {number}
      </span>
      <div className="grid min-w-0 gap-3">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{title}</h3>
            {optional && <Badge tone="neutral">Optional</Badge>}
            <Badge tone={tone} className="ml-auto">
              <Icon aria-hidden className={cn(state === "checking" && "animate-spin")} />
              {label}
            </Badge>
          </div>
          <p className="text-fg-muted">{description}</p>
        </div>
        {children}
      </div>
    </li>
  );
}
