import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  /** One sentence that teaches what this view is for. */
  description: string;
  /** A primary action or a template picker. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-card bg-surface-sunken text-fg-muted">
        <Icon aria-hidden className="size-6" />
      </span>
      <div className="grid max-w-sm gap-1">
        <h2 className="font-serif text-lg text-fg">{title}</h2>
        <p className="text-fg-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
