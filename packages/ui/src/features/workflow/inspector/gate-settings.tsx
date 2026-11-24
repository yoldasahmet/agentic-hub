import { fieldsToSchema, type GateNode, schemaToFields } from "@agentic/contracts";
import { useId, useState } from "react";
import { TemplateInput } from "../../../patterns/prompt-editor/template-input";
import { fieldIssues } from "../../../patterns/schema-editor/field-issues";
import { SchemaEditor } from "../../../patterns/schema-editor/schema-editor";
import { Input } from "../../../primitives/input";
import { Label } from "../../../primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select";

type Props = { node: GateNode; onChange: (node: GateNode) => void };

/** What a gate shows the reviewer: title, message, editable fields, and what reject does. */
export function GateSettings({ node, onChange }: Props) {
  const id = useId();
  // Field names may be mid-edit; the schema is stored once they are valid.
  const [fields, setFields] = useState(() => schemaToFields(node.schema));
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          id={`${id}-title`}
          value={node.title}
          onChange={(event) => onChange({ ...node, title: event.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-message`}>Message</Label>
        <TemplateInput
          id={`${id}-message`}
          value={node.message}
          fields={fields.map((f) => f.name)}
          placeholder="What should the reviewer check? Use {{input.field}}."
          onChange={(message) => onChange({ ...node, message })}
        />
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Fields the reviewer sees and can edit</span>
        <SchemaEditor
          fields={fields}
          emptyHint="No fields: the reviewer only approves or rejects."
          onChange={(next) => {
            setFields(next);
            if (fieldIssues(next).size === 0) onChange({ ...node, schema: fieldsToSchema(next) });
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>On reject</Label>
        <Select
          value={node.onReject}
          onValueChange={(v) =>
            onChange({ ...node, onReject: v === "continue" ? "continue" : "stop" })
          }
        >
          <SelectTrigger aria-label="On reject">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stop">Stop the run</SelectItem>
            <SelectItem value="continue">Continue with approved = false</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
