import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { EntityAvatar } from "../../patterns/entity-avatar";
import { Input } from "../../primitives/input";
import { PALETTE_MIME } from "./canvas/workflow-canvas";
import { gateEntity, type PaletteItem } from "./types";

export type NodePaletteProps = {
  agents: PaletteItem[];
  workflows: PaletteItem[];
  onAdd: (item: PaletteItem) => void;
};

const gate: PaletteItem = {
  kind: "gate",
  entity: gateEntity,
  description: "A person approves, edits, or rejects",
};

/** Agents, subworkflows, and a gate: drag onto the canvas or click to add. */
export function NodePalette({ agents, workflows, onAdd }: NodePaletteProps) {
  const [query, setQuery] = useState("");
  const match = (item: PaletteItem) => item.entity.name.toLowerCase().includes(query.toLowerCase());
  const groups: Array<[string, PaletteItem[]]> = [
    ["Control", [gate].filter(match)],
    ["Agents", agents.filter(match)],
    ["Workflows", workflows.filter(match)],
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative p-3">
        <Search aria-hidden className="absolute top-5 left-5 size-3.5 text-fg-subtle" />
        <Input
          aria-label="Search nodes"
          placeholder="Search"
          className="pl-7"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {groups.map(([title, items]) =>
          items.length === 0 ? null : (
            <section key={title} className="mb-3 grid gap-1">
              <h3 className="px-1 text-xs font-medium text-fg-subtle uppercase">{title}</h3>
              {items.map((item) => (
                <PaletteRow key={`${item.kind}:${item.id ?? "gate"}`} item={item} onAdd={onAdd} />
              ))}
            </section>
          ),
        )}
        {agents.length === 0 && (
          <p className="px-1 text-sm text-fg-muted">Create or install agents to use them here.</p>
        )}
      </div>
    </div>
  );
}

function PaletteRow({ item, onAdd }: { item: PaletteItem; onAdd: (item: PaletteItem) => void }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(PALETTE_MIME, JSON.stringify(item));
        event.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onAdd(item)}
      className="group flex items-center gap-2 rounded-control px-1.5 py-1.5 text-left hover:bg-surface-sunken"
    >
      <EntityAvatar
        size="sm"
        color={item.entity.color}
        icon={item.kind === "workflow" ? "workflow" : item.entity.icon}
      />
      <span className="grid min-w-0 flex-1">
        <span className="truncate">{item.entity.name}</span>
        {item.description && (
          <span className="truncate text-xs text-fg-subtle">{item.description}</span>
        )}
      </span>
      <Plus aria-hidden className="size-3.5 text-fg-subtle opacity-0 group-hover:opacity-100" />
    </button>
  );
}
