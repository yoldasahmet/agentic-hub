import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-solid hover:bg-primary-hover",
        secondary: "border border-border-input bg-surface text-fg hover:bg-surface-sunken",
        ghost: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
        danger: "bg-danger text-on-solid hover:bg-danger-ink",
        link: "text-accent-ink underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-7 px-2.5 text-sm",
        md: "h-8 px-3",
        lg: "h-10 px-4 text-prose",
        icon: "size-8",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
