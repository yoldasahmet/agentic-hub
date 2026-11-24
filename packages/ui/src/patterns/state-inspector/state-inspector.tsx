import type { Checkpoint } from "@agentic/contracts";
import { GitFork } from "lucide-react";
import { useState } from "react";
import { Button } from "../../primitives/button";
import { ScrollArea } from "../../primitives/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../primitives/tabs";
import { CheckpointTimeline } from "./checkpoint-timeline";
import { JsonEditor } from "./json-editor";
import { JsonView } from "./json-view";
import { StateDiff } from "./state-diff";

export type StateInspectorProps = {
  /** Newest first, as the history API returns them. */
  checkpoints: Checkpoint[];
  /** Node names for "write as node" (from the graph). */
  nodes: string[];
  busy?: boolean;
  /** Edits are only allowed on the latest checkpoint while no run is executing. */
  canEdit: boolean;
  onSave: (values: Record<string, unknown>, asNode: string | undefined) => void;
  onFork: (checkpointId: string) => void;
};

/**
 * A thread's checkpoint timeline with the selected checkpoint's state,
 * its diff from the parent, an editor, and fork-from-here (time travel).
 */
export function StateInspector({
  checkpoints,
  nodes,
  busy,
  canEdit,
  onSave,
  onFork,
}: StateInspectorProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = checkpoints.find((c) => c.checkpointId === selectedId) ?? checkpoints[0];
  const parent = checkpoints.find((c) => c.checkpointId === selected?.parentCheckpointId);
  const isLatest = selected !== undefined && selected === checkpoints[0];

  return (
    <div className="grid min-h-0 grid-cols-[16rem_1fr] overflow-hidden rounded-card border border-border bg-surface">
      <ScrollArea className="border-r border-border">
        <CheckpointTimeline
          checkpoints={checkpoints}
          selectedId={selected?.checkpointId}
          onSelect={setSelectedId}
        />
      </ScrollArea>
      {selected ? (
        <Tabs defaultValue="state" className="flex min-h-0 min-w-0 flex-col p-3">
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="state">State</TabsTrigger>
              <TabsTrigger value="diff">Diff</TabsTrigger>
              {canEdit && isLatest && <TabsTrigger value="edit">Edit</TabsTrigger>}
            </TabsList>
            <span className="flex-1" />
            <span className="font-mono text-code text-fg-subtle" data-selectable>
              {selected.checkpointId.slice(0, 13)}
            </span>
            <Button size="sm" disabled={busy} onClick={() => onFork(selected.checkpointId)}>
              <GitFork aria-hidden /> Fork from here
            </Button>
          </div>
          <TabsContent value="state" className="mt-3 grid min-h-0 gap-3 overflow-auto">
            {selected.next.length > 0 && (
              <p className="text-fg-muted">Next: {selected.next.join(", ")}</p>
            )}
            {selected.interrupts.length > 0 && (
              <JsonView
                value={selected.interrupts.map((i) => ({ node: i.node, value: i.value }))}
              />
            )}
            <JsonView value={selected.values} />
          </TabsContent>
          <TabsContent value="diff" className="mt-3 min-h-0 overflow-auto">
            <StateDiff before={parent?.values} after={selected.values} />
          </TabsContent>
          {canEdit && isLatest && (
            <TabsContent value="edit" className="mt-3 min-h-0 overflow-auto">
              <JsonEditor
                key={selected.checkpointId}
                initial={selected.values}
                nodes={nodes}
                busy={busy}
                onSave={onSave}
              />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <p className="p-3 text-fg-muted">Select a checkpoint.</p>
      )}
    </div>
  );
}
