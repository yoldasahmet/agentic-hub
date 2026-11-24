import { Command } from "cmdk";
import type { LucideIcon } from "lucide-react";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { KeyHint } from "./key-hint";

export type CommandItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Shown instead of `icon`, e.g. an entity's avatar. */
  visual?: ReactNode;
  shortcut?: string[];
  keywords?: string[];
  onSelect: () => void;
};

export type CommandGroup = { heading: string; items: CommandItem[] };

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroup[];
  placeholder?: string;
};

/** The global ⌘K palette: go to, create, run. Callers own the commands. */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = "Search or jump to…",
}: CommandPaletteProps) {
  const run = (item: CommandItem) => {
    onOpenChange(false);
    item.onSelect();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-fg/20" />
        <DialogPrimitive.Content className="fixed top-[18%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-dialog border border-border bg-surface-raised shadow-2">
          <VisuallyHidden.Root>
            <DialogPrimitive.Title>Command palette</DialogPrimitive.Title>
          </VisuallyHidden.Root>
          <Command loop>
            <Command.Input
              autoFocus
              placeholder={placeholder}
              className="h-11 w-full border-b border-border bg-transparent px-4 text-prose text-fg outline-none placeholder:text-fg-subtle"
            />
            <Command.List className="max-h-80 overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-fg-muted">
                No results.
              </Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={group.heading}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-muted"
                >
                  {group.items.map((item) => (
                    <PaletteItem key={item.id} item={item} onRun={run} />
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PaletteItem({ item, onRun }: { item: CommandItem; onRun: (item: CommandItem) => void }) {
  const Icon = item.icon;
  return (
    <Command.Item
      value={`${item.id} ${item.label}`}
      keywords={item.keywords}
      onSelect={() => onRun(item)}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-control px-2 py-2 text-fg",
        "data-[selected=true]:bg-accent-tint data-[selected=true]:text-accent-ink",
      )}
    >
      {item.visual ?? (Icon && <Icon aria-hidden className="size-4 shrink-0" />)}
      <span className="flex-1 truncate">{item.label}</span>
      {item.shortcut && <KeyHint keys={item.shortcut} />}
    </Command.Item>
  );
}
