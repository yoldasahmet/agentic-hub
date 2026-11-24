import { type IoFieldType, ioFieldTypeSchema } from "@agentic/contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select";

export const fieldTypeLabels: Record<IoFieldType, string> = {
  text: "Text",
  long: "Long text",
  number: "Number",
  integer: "Integer",
  bool: "Yes / no",
  select: "Choice",
  multi: "List",
  json: "JSON",
};

export function FieldTypeSelect({
  value,
  onChange,
  id,
}: {
  value: IoFieldType;
  onChange: (type: IoFieldType) => void;
  id?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const type = ioFieldTypeSchema.safeParse(next);
        if (type.success) onChange(type.data);
      }}
    >
      <SelectTrigger id={id} aria-label="Field type" className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(fieldTypeLabels).map(([type, label]) => (
          <SelectItem key={type} value={type}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
