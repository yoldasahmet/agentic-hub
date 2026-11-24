import { z } from "zod";

const rowsSchema = z.array(z.record(z.string(), z.unknown())).min(1);

/** Rows when the value is a non-empty list of objects. */
export function recordsOf(value: unknown): Array<Record<string, unknown>> | undefined {
  const parsed = rowsSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

const cell = (value: unknown) =>
  typeof value === "string" ? value : value === undefined ? "" : JSON.stringify(value);

/** A list of objects as a table; columns are the union of their keys, in first-seen order. */
export function RecordTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    <div className="overflow-auto rounded-control border border-border">
      <table data-selectable className="w-full border-collapse text-left">
        <thead className="bg-surface-sunken">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-1.5 font-medium text-fg-muted">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            <tr key={index} className="border-t border-border align-top">
              {columns.map((column) => (
                <td key={column} className="whitespace-pre-wrap px-3 py-1.5">
                  {cell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
