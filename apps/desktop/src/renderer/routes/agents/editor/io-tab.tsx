import {
  type IoField,
  type OutputFormat,
  outputFormatSchema,
  outputFormats,
} from "@agentic/contracts";
import {
  Label,
  SchemaEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentic/ui";

const formatLabels: Record<OutputFormat, string> = {
  markdown: "Markdown",
  json: "JSON",
  plan: "Plan (steps)",
  diff: "Diff",
  html: "HTML",
  table: "Table",
};

type Props = {
  inputs: IoField[];
  outputs: IoField[];
  format: OutputFormat;
  onInputs: (fields: IoField[]) => void;
  onOutputs: (fields: IoField[]) => void;
  onFormat: (format: OutputFormat) => void;
};

/** Inputs on the left, outputs and how they render on the right. */
export function IoTab({ inputs, outputs, format, onInputs, onOutputs, onFormat }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="grid content-start gap-3">
        <div>
          <h2 className="font-serif text-lg">Inputs</h2>
          <p className="text-fg-muted">What the agent needs. Forms and chat ask for these.</p>
        </div>
        <SchemaEditor fields={inputs} onChange={onInputs} emptyHint="This agent takes no inputs." />
      </section>
      <section className="grid content-start gap-3">
        <div>
          <h2 className="font-serif text-lg">Outputs</h2>
          <p className="text-fg-muted">
            The answer is checked against these and repaired if needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="output-format">Show as</Label>
          <Select
            value={format}
            onValueChange={(next) => {
              const parsed = outputFormatSchema.safeParse(next);
              if (parsed.success) onFormat(parsed.data);
            }}
          >
            <SelectTrigger id="output-format" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {outputFormats.map((f) => (
                <SelectItem key={f} value={f}>
                  {formatLabels[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SchemaEditor
          fields={outputs}
          onChange={onOutputs}
          emptyHint="No output fields: the answer is free text."
        />
      </section>
    </div>
  );
}
