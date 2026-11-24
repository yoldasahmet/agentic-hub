import { type McpServer, type McpServerInput, mcpServerInputSchema } from "@agentic/contracts";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@agentic/ui";
import { type ReactNode, useId, useState } from "react";
import { showError } from "../../../lib/show-error";
import { useSaveMcpServer } from "../tools/queries";
import { formatPairs, parsePairs } from "./pairs";

type Draft = {
  name: string;
  transport: "stdio" | "http";
  command: string;
  args: string;
  env: string;
  secretEnv: string;
  url: string;
  headers: string;
  secretHeaders: string;
};

function toDraft(server?: McpServer): Draft {
  const c = server?.config;
  return {
    name: server?.name ?? "",
    transport: c?.transport ?? "stdio",
    command: c?.transport === "stdio" ? c.command : "",
    args: c?.transport === "stdio" ? c.args.join("\n") : "",
    env: c?.transport === "stdio" ? formatPairs(c.env) : "",
    secretEnv: c?.transport === "stdio" ? formatPairs(c.secretEnv) : "",
    url: c?.transport === "http" ? c.url : "",
    headers: c?.transport === "http" ? formatPairs(c.headers, ": ") : "",
    secretHeaders: c?.transport === "http" ? formatPairs(c.secretHeaders, ": ") : "",
  };
}

function toInput(d: Draft, enabled: boolean): McpServerInput {
  const config =
    d.transport === "stdio"
      ? {
          transport: "stdio" as const,
          command: d.command.trim(),
          args: d.args
            .split("\n")
            .map((a) => a.trim())
            .filter(Boolean),
          env: parsePairs(d.env),
          secretEnv: parsePairs(d.secretEnv),
        }
      : {
          transport: "http" as const,
          url: d.url.trim(),
          headers: parsePairs(d.headers, ":"),
          secretHeaders: parsePairs(d.secretHeaders, ":"),
        };
  return { name: d.name.trim(), enabled, config };
}

/** Add or edit an MCP server. Secrets are vault names (`mcp.…`), never values. */
export function ServerForm({ server, onDone }: { server?: McpServer; onDone: () => void }) {
  const id = useId();
  const [draft, setDraft] = useState(() => toDraft(server));
  const save = useSaveMcpServer();
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const submit = () => {
    const parsed = mcpServerInputSchema.safeParse(toInput(draft, server?.enabled ?? true));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return toast.error(`${issue?.path.join(".")}: ${issue?.message}`);
    }
    save.mutate(
      { id: server?.id, value: parsed.data },
      { onSuccess: onDone, onError: (err) => showError(err) },
    );
  };
  const field = (key: keyof Draft, label: string, node: ReactNode) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      {node}
    </div>
  );
  const text = (key: keyof Draft, placeholder: string) => (
    <Textarea
      id={`${id}-${key}`}
      className="min-h-16 font-mono text-code"
      placeholder={placeholder}
      value={draft[key]}
      onChange={(e) => set({ [key]: e.target.value })}
    />
  );
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {field(
        "name",
        "Name",
        <Input
          id={`${id}-name`}
          value={draft.name}
          placeholder="linear"
          onChange={(e) => set({ name: e.target.value })}
        />,
      )}
      {field(
        "transport",
        "Transport",
        <Select
          value={draft.transport}
          onValueChange={(t) => set({ transport: t === "http" ? "http" : "stdio" })}
        >
          <SelectTrigger id={`${id}-transport`} className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stdio">Local command (stdio)</SelectItem>
            <SelectItem value="http">Remote URL (HTTP)</SelectItem>
          </SelectContent>
        </Select>,
      )}
      {draft.transport === "stdio" ? (
        <>
          {field(
            "command",
            "Command",
            <Input
              id={`${id}-command`}
              className="font-mono text-code"
              placeholder="npx"
              value={draft.command}
              onChange={(e) => set({ command: e.target.value })}
            />,
          )}
          {field(
            "args",
            "Arguments (one per line)",
            text("args", "-y\n@modelcontextprotocol/server-everything"),
          )}
          {field("env", "Environment (KEY=value)", text("env", "LOG_LEVEL=info"))}
          {field(
            "secretEnv",
            "Secret environment (KEY=secret name)",
            text("secretEnv", "API_TOKEN=mcp.linear.token"),
          )}
        </>
      ) : (
        <>
          {field(
            "url",
            "URL",
            <Input
              id={`${id}-url`}
              className="font-mono text-code"
              placeholder="https://mcp.example.com/mcp"
              value={draft.url}
              onChange={(e) => set({ url: e.target.value })}
            />,
          )}
          {field("headers", "Headers (Name: value)", text("headers", "X-Team: core"))}
          {field(
            "secretHeaders",
            "Secret headers (Name: secret name)",
            text("secretHeaders", "Authorization: mcp.example.auth"),
          )}
        </>
      )}
      <p className="text-sm text-fg-muted">
        Store secret values in Settings → Secrets under a name starting with <code>mcp.</code>.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
