import { type LogLevel, logLevels } from "@agentic/contracts";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@agentic/ui";
import { RefreshCw, X } from "lucide-react";
import type { LogSearch } from "./search";

const ALL = "__all";

type Props = {
  search: LogSearch;
  modules: string[];
  text: string;
  live: boolean;
  refreshing: boolean;
  onSearch: (patch: Partial<LogSearch>) => void;
  onText: (text: string) => void;
  onLive: (live: boolean) => void;
  onRefresh: () => void;
};

/** Level, module, text, and the run/trace pins from the URL. */
export function LogFilters(props: Props) {
  const { search, modules, onSearch } = props;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={search.level ?? "info"}
          onValueChange={(v: LogLevel) => onSearch({ level: v })}
        >
          <SelectTrigger aria-label="Minimum level" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {logLevels.map((level) => (
              <SelectItem key={level} value={level}>
                {level === "fatal" ? "fatal" : `${level}+`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.module ?? ALL}
          onValueChange={(v) => onSearch({ module: v === ALL ? undefined : v })}
        >
          <SelectTrigger aria-label="Module" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All modules</SelectItem>
            {modules.map((module) => (
              <SelectItem key={module} value={module}>
                {module}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Search logs"
          placeholder="Search messages and fields"
          value={props.text}
          onChange={(e) => props.onText(e.target.value)}
          className="min-w-40 flex-1"
        />
        <div className="flex items-center gap-1.5">
          <Switch id="logs-live" checked={props.live} onCheckedChange={props.onLive} />
          <Label htmlFor="logs-live">Live</Label>
        </div>
        <Button variant="ghost" size="icon" aria-label="Refresh" onClick={props.onRefresh}>
          <RefreshCw aria-hidden className={props.refreshing ? "animate-spin" : undefined} />
        </Button>
      </div>
      {(search.runId || search.traceId) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {search.runId && (
            <Pin label="Run" value={search.runId} onClear={() => onSearch({ runId: undefined })} />
          )}
          {search.traceId && (
            <Pin
              label="Trace"
              value={search.traceId}
              onClear={() => onSearch({ traceId: undefined })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Pin({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-accent-ink">
      {label} <span className="font-mono">{value}</span>
      <button type="button" aria-label={`Clear ${label.toLowerCase()} filter`} onClick={onClear}>
        <X aria-hidden className="size-3" />
      </button>
    </span>
  );
}
