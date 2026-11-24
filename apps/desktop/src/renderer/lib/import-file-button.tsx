import type { BundleFormat } from "@agentic/contracts";
import { Button } from "@agentic/ui";
import { FileUp } from "lucide-react";
import { useRef } from "react";

type Props = {
  busy?: boolean;
  onImport: (file: { format: BundleFormat; content: string }) => void;
};

/** Picks a .json, .yaml, or .yml bundle and hands its text over (agents and workflows). */
export function ImportFileButton({ busy, onImport }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,.yaml,.yml,application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          onImport({
            format: /\.ya?ml$/i.test(file.name) ? "yaml" : "json",
            content: await file.text(),
          });
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={busy}>
        <FileUp aria-hidden /> Import
      </Button>
    </>
  );
}
