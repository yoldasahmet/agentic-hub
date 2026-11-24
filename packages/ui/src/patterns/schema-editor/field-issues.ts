import { type IoField, ioFieldNameSchema } from "@agentic/contracts";

/** Problems that block saving: invalid or duplicate names, and choice fields without choices. */
export function fieldIssues(fields: IoField[]): Map<number, string> {
  const issues = new Map<number, string>();
  const seen = new Map<string, number>();
  fields.forEach((field, index) => {
    if (!ioFieldNameSchema.safeParse(field.name).success) {
      issues.set(index, "Use letters, digits, and _ (not first)");
    } else if (seen.has(field.name)) {
      issues.set(index, `"${field.name}" is used twice`);
    } else if (field.type === "select" && !field.options?.length) {
      issues.set(index, "Add at least one choice");
    }
    seen.set(field.name, index);
  });
  return issues;
}

/** A name not in use yet: `field_1`, `field_2`, … */
export function nextFieldName(fields: IoField[]): string {
  const names = new Set(fields.map((f) => f.name));
  for (let n = 1; ; n++) if (!names.has(`field_${n}`)) return `field_${n}`;
}
