import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

/** Toasts styled with design tokens. Call `toast(...)` from "sonner" via the ui index. */
export function Toaster(props: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-card !border !border-border !bg-surface-raised !text-fg !shadow-2 !font-sans",
          description: "!text-fg-muted",
          actionButton: "!bg-primary !text-on-solid",
        },
      }}
      {...props}
    />
  );
}
