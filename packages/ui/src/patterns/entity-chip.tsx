import type { EntityIdentity } from "@agentic/contracts";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { EntityAvatar } from "./entity-avatar";

export type EntityChipProps = Omit<ComponentProps<"span">, "color"> & {
  entity: EntityIdentity;
};

/** Color + icon + name, used for an agent or workflow everywhere it is referenced. */
export function EntityChip({ entity, className, ...props }: EntityChipProps) {
  return (
    <span
      data-hue={entity.color}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-hue-tint py-0.5 pr-2.5 pl-0.5 text-sm font-medium text-hue-ink",
        className,
      )}
      {...props}
    >
      <EntityAvatar color={entity.color} icon={entity.icon} size="sm" className="rounded-full" />
      <span className="truncate">{entity.name}</span>
    </span>
  );
}
