import { fieldsToSchema } from "@agentic/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { type FormValue, SchemaForm, schemaDefaults } from "./schema-form";

const schema = fieldsToSchema([
  { name: "title", type: "text", description: "Short title", required: true },
  { name: "body", type: "long", description: "", required: false },
  { name: "count", type: "integer", description: "", required: false },
  { name: "draft", type: "bool", description: "", required: false },
  { name: "tags", type: "multi", description: "", required: false },
  {
    name: "level",
    type: "select",
    description: "",
    required: false,
    default: "low",
    options: ["low", "high"],
  },
]);

/** A controlled form, like its callers keep it. */
function Harness({ onChange, issues }: { onChange: (v: FormValue) => void; issues?: string[] }) {
  const [value, setValue] = useState<FormValue>(schemaDefaults(schema));
  return (
    <SchemaForm
      schema={schema}
      value={value}
      issues={issues}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("SchemaForm", () => {
  it("renders a labeled widget per field, marking required ones", () => {
    render(<Harness onChange={() => undefined} />);
    expect(screen.getByLabelText(/title/)).toBeTruthy();
    expect(screen.getByText("Short title")).toBeTruthy();
    expect(screen.getByText("*")).toBeTruthy();
    expect(screen.getByLabelText("count").getAttribute("type")).toBe("number");
    expect(screen.getByRole("switch", { name: "draft" })).toBeTruthy();
  });

  it("starts from defaults and emits typed values, dropping cleared ones", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByLabelText(/title/), "Hi");
    await user.type(screen.getByLabelText("count"), "3");
    await user.click(screen.getByRole("switch", { name: "draft" }));
    expect(onChange).toHaveBeenLastCalledWith({ level: "low", draft: true, title: "Hi", count: 3 });
    await user.clear(screen.getByLabelText(/title/));
    expect(onChange.mock.lastCall?.[0]).not.toHaveProperty("title");
  });

  it("shows field issues next to their field and the rest below", () => {
    render(
      <Harness
        onChange={() => undefined}
        issues={["title: Required", "(root): Too many fields"]}
      />,
    );
    expect(screen.getByText("Required")).toBeTruthy();
    expect(screen.getByText("(root): Too many fields")).toBeTruthy();
    expect(screen.getByLabelText(/title/).getAttribute("aria-invalid")).toBe("true");
  });

  it("switches to JSON editing", async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => undefined} />);
    await user.click(screen.getByRole("switch", { name: "Edit as JSON" }));
    expect(screen.getByLabelText("Values as JSON")).toBeTruthy();
    expect(screen.queryByLabelText("count")).toBeNull();
  });

  it("explains an empty schema", () => {
    render(
      <SchemaForm
        schema={fieldsToSchema([])}
        value={{}}
        onChange={() => undefined}
        emptyHint="Nothing to fill"
      />,
    );
    expect(screen.getByText("Nothing to fill")).toBeTruthy();
  });
});
