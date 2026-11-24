import type { DbTlsMode } from "@agentic/contracts";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentic/ui";
import { useId } from "react";

const tlsOptions: { value: DbTlsMode; label: string }[] = [
  { value: "verify-full", label: "Verify certificate (recommended)" },
  { value: "require", label: "Encrypt, don't verify (self-signed)" },
  { value: "disable", label: "No TLS (trusted network only)" },
];

type Props = {
  url: string;
  onUrlChange: (url: string) => void;
  tls: DbTlsMode;
  onTlsChange: (tls: string) => void;
  /** A URL is already in the vault; leaving the field blank keeps it. */
  saved: boolean;
  invalid: boolean;
};

/** The connection string is write-only: it goes to the vault and is never shown again. */
export function RemoteFields({ url, onUrlChange, tls, onTlsChange, saved, invalid }: Props) {
  const id = useId();
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-url`}>Connection string</Label>
        <Input
          id={`${id}-url`}
          type="password"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={
            saved
              ? "Saved in the vault. Enter a new one to replace it."
              : "postgres://user:password@host:5432/agentic"
          }
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          aria-invalid={invalid ? true : undefined}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-tls`}>TLS</Label>
        <Select value={tls} onValueChange={onTlsChange}>
          <SelectTrigger id={`${id}-tls`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tlsOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-fg-subtle">
        Data isn't copied between databases. Move agents and workflows with export and import.
      </p>
    </div>
  );
}
