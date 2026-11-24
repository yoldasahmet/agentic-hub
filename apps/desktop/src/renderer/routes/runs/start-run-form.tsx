import { Button, Input } from "@agentic/ui";
import { Play } from "lucide-react";
import { useState } from "react";
import { showError } from "../../lib/show-error";
import { useAssistants, useCreateRun } from "./queries";

type Props = { onStarted: (threadId: string) => void };

/**
 * Starts a run of a registered assistant. Until agents and workflows land
 * (P6/P7) the built-in sample graph is the only one; it takes a topic.
 */
export function StartRunForm({ onStarted }: Props) {
  const assistant = useAssistants().data?.[0];
  const create = useCreateRun();
  const [topic, setTopic] = useState("");

  if (!assistant) return null;
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate(
          { assistantId: assistant.id, input: { topic: topic.trim() || "LangGraph" } },
          {
            onSuccess: (run) => onStarted(run.threadId),
            onError: (err) => showError(err),
          },
        );
      }}
    >
      <Input
        aria-label="Topic"
        className="w-56"
        placeholder={`Topic for ${assistant.name}`}
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
      />
      <Button type="submit" variant="primary" size="md" disabled={create.isPending}>
        <Play aria-hidden /> Run
      </Button>
    </form>
  );
}
