import { EmptyState, ScrollArea } from "@agentic/ui";
import { Bot } from "lucide-react";
import { useCore } from "../../lib/core";
import { AgentCard } from "./agent-card";
import { ImportButton } from "./import-button";
import { LibraryDialog } from "./library-dialog";
import { NewAgentDialog } from "./new-agent-dialog";
import { useAgents } from "./queries";

/** Agents: every agent in the workspace, plus new, import, and the built-in library. */
export function AgentsPage() {
  const core = useCore();
  const agents = useAgents();
  const list = agents.data ?? [];
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h1 className="flex-1 font-serif text-lg">Agents</h1>
        {core && (
          <>
            <LibraryDialog />
            <ImportButton />
            <NewAgentDialog />
          </>
        )}
      </header>
      {!core ? (
        <EmptyState
          icon={Bot}
          title="Core is starting"
          description="Agents appear once the embedded server is ready."
        />
      ) : agents.isSuccess && list.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create an agent with its own prompt, model, inputs, and outputs, or start from the library."
          action={
            <div className="flex gap-2">
              <LibraryDialog />
              <NewAgentDialog />
            </div>
          }
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((agent) => (
              <li key={agent.id}>
                <AgentCard agent={agent} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
