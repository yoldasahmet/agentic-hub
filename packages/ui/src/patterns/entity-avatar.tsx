import type { IdentityColor, IdentityIcon } from "@agentic/contracts";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { entityIcon } from "./entity-icons";

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center bg-hue-solid text-on-solid",
  {
    variants: {
      size: {
        xs: "size-4 rounded-[4px] [&_svg]:size-2.5",
        sm: "size-5 rounded-[5px] [&_svg]:size-3",
        md: "size-7 rounded-control [&_svg]:size-4",
        lg: "size-10 rounded-card [&_svg]:size-5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type EntityAvatarProps = VariantProps<typeof avatarVariants> & {
  color: IdentityColor;
  icon: IdentityIcon;
  /** Accessible name. Omit when the entity name is shown next to the avatar. */
  label?: string;
  className?: string;
};

/** An agent's or workflow's icon on its identity color. White on `solid` passes 3:1. */
export function EntityAvatar({ color, icon, label, size, className }: EntityAvatarProps) {
  const Icon = entityIcon(icon);
  return (
    <span
      data-hue={color}
      aria-hidden={label ? undefined : true}
      className={cn(avatarVariants({ size }), className)}
    >
      <Icon aria-hidden />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
