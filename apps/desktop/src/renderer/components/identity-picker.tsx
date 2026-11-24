import { type IdentityColor, type IdentityIcon, identityColors } from "@agentic/contracts";
import {
  cn,
  EntityAvatar,
  entityIcon,
  entityIconNames,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@agentic/ui";

type Props = {
  color: IdentityColor;
  icon: IdentityIcon;
  onChange: (patch: { color?: IdentityColor; icon?: IdentityIcon }) => void;
};

/** An agent's or workflow's avatar; clicking it picks one of the ten identity hues and a Lucide icon. */
export function IdentityPicker({ color, icon, onChange }: Props) {
  return (
    <Popover>
      <PopoverTrigger aria-label="Change color and icon" className="rounded-control">
        <EntityAvatar color={color} icon={icon} size="lg" />
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-72 gap-3">
        <fieldset aria-label="Color" className="flex flex-wrap gap-1.5">
          {identityColors.map((hue) => (
            <button
              key={hue}
              type="button"
              aria-pressed={hue === color}
              aria-label={hue}
              data-hue={hue}
              className="size-6 rounded-full bg-hue-solid ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-accent"
              onClick={() => onChange({ color: hue })}
            />
          ))}
        </fieldset>
        <fieldset aria-label="Icon" className="grid grid-cols-8 gap-1">
          {entityIconNames.map((name) => {
            const Icon = entityIcon(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={name === icon}
                aria-label={name}
                className={cn(
                  "flex size-7 items-center justify-center rounded-control text-fg-muted hover:bg-surface-sunken",
                  "aria-pressed:bg-accent-tint aria-pressed:text-accent-ink",
                )}
                onClick={() => onChange({ icon: name })}
              >
                <Icon aria-hidden className="size-4" />
              </button>
            );
          })}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
