import { type ModelRef, modelRefSchema } from "@agentic/contracts";
import { parse, parseInputs, parseVersion, required, usageError } from "../args";
import { connect } from "../connect";
import { findByRef, launch, runOptions } from "../launch";
import { printJson, table } from "../output";

export const agentsUsage = `agentic agents list [--archived] [--json]
agentic agents run <id|slug> [-i key=value]… [--input-json '{…}'] [--version draft|N]
                   [--model provider/model] [--detach] [--json]`;

/** `provider/model`; the model part may itself contain slashes (OpenRouter ids). */
function parseModel(text: string | undefined): ModelRef | undefined {
  if (text === undefined) return undefined;
  const at = text.indexOf("/");
  if (at < 1) throw usageError(`--model expects provider/model, got "${text}".`);
  return modelRefSchema.parse({ providerId: text.slice(0, at), model: text.slice(at + 1) });
}

export async function agentsCommand([sub, ...rest]: string[]): Promise<number> {
  if (sub === "list") {
    const { values } = parse(rest, { archived: { type: "boolean" } });
    const { client } = await connect(values["data-dir"]);
    const agents = await client.agents.list(values.archived ?? false);
    if (values.json) printJson(agents);
    else
      table(
        agents.map((a) => ({
          id: a.id,
          slug: a.slug,
          name: a.name,
          kind: a.kind,
          version: a.latestVersion ? `v${a.latestVersion}` : "draft",
        })),
        ["id", "slug", "name", "kind", "version"],
      );
    return 0;
  }
  if (sub === "run") {
    const { values, positionals } = parse(rest, { ...runOptions, model: { type: "string" } });
    const ref = required(positionals, 0, "agent");
    const input = parseInputs(values.input, values["input-json"]);
    const version = parseVersion(values.version);
    const model = parseModel(values.model);
    const session = await connect(values["data-dir"]);
    const agent = findByRef(await session.client.agents.list(), ref, "agent");
    return launch(
      session,
      () => session.client.agents.run(agent.id, { input, version, model }),
      values,
    );
  }
  throw usageError(`Usage:\n${agentsUsage}`);
}
