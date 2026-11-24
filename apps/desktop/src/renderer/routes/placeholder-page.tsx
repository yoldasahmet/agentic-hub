import { EmptyState } from "@agentic/ui";
import type { NavItem } from "../shell/nav-items";

/** A feature's landing page until its phase lands. */
export function PlaceholderPage({ item }: { item: NavItem }) {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={item.icon}
        title={item.label}
        description={item.description}
        action={<p className="text-sm text-fg-subtle">Coming in a later phase of the roadmap.</p>}
      />
    </div>
  );
}
