import { checkJsonSchema } from "@agentic/llm";
import { expect, it } from "vitest";
import { builtinAgents } from "./builtins";

it("requires a merge result even when the SDLC project has no deployment URL", () => {
  const schema = builtinAgents.find(({ agent }) => agent.slug === "sdlc-deployer")?.agent.spec
    .outputSchema;
  if (!schema) throw new Error("Missing SDLC deployer output schema");
  expect(checkJsonSchema(schema, { version: "", url: "" }).ok).toBe(false);
  expect(checkJsonSchema(schema, { version: "a89d69f", url: "" }).ok).toBe(true);
});
