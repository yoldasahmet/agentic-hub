import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const fieldClass =
  "w-full rounded-control border border-border-input bg-surface px-2.5 text-fg placeholder:text-fg-subtle focus-visible:border-accent disabled:opacity-50 aria-invalid:border-danger";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(fieldClass, "h-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-20 py-1.5", className)} {...props} />;
}
