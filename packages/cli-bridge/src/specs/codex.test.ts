import { describe, expect, it } from "vitest";
import { codexSpec } from "./codex";

describe("Codex host tools", () => {
  it("isolates workflow actions from personal connectors, plugins and the native shell", async () => {
    const { args } = await codexSpec.invoke(
      { model: "default", messages: [] },
      { hostTools: true },
    );
    expect(args).toContain("--ignore-user-config");
    const disabled = args.flatMap((arg, index) => (arg === "--disable" ? args[index + 1] : []));
    expect(disabled).toEqual(expect.arrayContaining(["apps", "plugins", "shell_tool"]));
  });
});
