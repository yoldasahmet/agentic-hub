import type { ComponentProps } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "../lib/cn";

/** Resizable panes (react-resizable-panels): the chat's list · conversation · context panel. */
export function ResizableGroup({ className, ...props }: ComponentProps<typeof Group>) {
  return <Group className={cn("flex h-full w-full", className)} {...props} />;
}

export const ResizablePanel = Panel;
export { useDefaultLayout, usePanelRef } from "react-resizable-panels";

/** A 1px divider with a wider invisible hit area; keyboard-resizable when focused. */
export function ResizableHandle({ className, ...props }: ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "relative w-px shrink-0 bg-border outline-none transition-colors duration-150",
        "after:absolute after:inset-y-0 after:-right-1.5 after:-left-1.5",
        "hover:bg-accent focus-visible:bg-accent",
        className,
      )}
      {...props}
    />
  );
}
