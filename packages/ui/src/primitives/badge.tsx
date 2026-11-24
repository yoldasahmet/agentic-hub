import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-fg-muted",
        accent: "bg-accent-tint text-accent-ink",
        success: "bg-success-tint text-success-ink",
        warning: "bg-warning-tint text-warning-ink",
        danger: "bg-danger-tint text-danger-ink",
        info: "bg-info-tint text-info-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
