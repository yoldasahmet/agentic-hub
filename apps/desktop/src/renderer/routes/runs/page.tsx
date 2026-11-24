import { EmptyState, ScrollArea } from "@agentic/ui";
import { Activity } from "lucide-react";
import { useState } from "react";
import { useCore } from "../../lib/core";
import { useThreads } from "./queries";
import { StartRunForm } from "./start-run-form";
import { ThreadList } from "./thread-list";
import { ThreadPanel } from "./thread-panel";

/** Runs: every thread on the embedded LangGraph server, with its state history. */
export function RunsPage() {
  const core = useCore();
  const threads = useThreads().data ?? [];
  const [selected, setSelected] = useState<string | undefined>();
  const threadId = selected ?? threads[0]?.id;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="flex-1 font-serif text-lg">Runs</h1>
        {core && <StartRunForm onStarted={setSelected} />}
      </header>
      {!core ? (
        <EmptyState
          icon={Activity}
          title="Core is starting"
          description="Runs appear once the embedded server is ready."
        />
      ) : threads.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No runs yet"
          description="Run the sample graph to see each checkpoint, edit state, and fork from any step."
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[18rem_1fr]">
          <ScrollArea className="border-r border-border bg-surface">
            <ThreadList threads={threads} selectedId={threadId} onSelect={setSelected} />
          </ScrollArea>
          {threadId && <ThreadPanel key={threadId} threadId={threadId} onForked={setSelected} />}
        </div>
      )}
    </div>
  );
}
