import { AppError } from "@agentic/contracts";
import { answerOptions, buildAnswer, pickInterrupt } from "../answer";
import { parse, parseInputs, parseVersion, required, usageError } from "../args";
import { connect } from "../connect";
import { exitCodeFor, followRun, printResumeHint, printStoredEvents } from "../follow";
import { findByRef, launch, runOptions } from "../launch";
import { printJson, table } from "../output";

export const workflowsUsage = `agentic workflows list [--archived] [--json]
agentic workflows run <id|slug> [-i key=value]… [--input-json '{…}'] [--version draft|N]
                      [--detach] [--json]
agentic workflows resume <run-id> --approve | --reject | --answer '<json>'
                      [--data '{…}'] [--comment text] [--interrupt id] [--detach] [--json]`;

async function list(rest: string[]): Promise<number> {
  const { values } = parse(rest, { archived: { type: "boolean" } });
  const { client } = await connect(values["data-dir"]);
  const workflows = await client.workflows.list(values.archived ?? false);
  if (values.json) printJson(workflows);
  else
    table(
      workflows.map((w) => ({
        id: w.id,
        slug: w.slug,
        name: w.name,
        version: w.latestVersion ? `v${w.latestVersion}` : "draft",
      })),
      ["id", "slug", "name", "version"],
    );
  return 0;
}

async function run(rest: string[]): Promise<number> {
  const { values, positionals } = parse(rest, runOptions);
  const ref = required(positionals, 0, "workflow");
  const input = parseInputs(values.input, values["input-json"]);
  const version = parseVersion(values.version);
  const session = await connect(values["data-dir"]);
  const workflow = findByRef(await session.client.workflows.list(), ref, "workflow");
  return launch(
    session,
    () => session.client.workflows.run(workflow.id, { input, version }),
    values,
  );
}

/** Answers the run's waiting gate, then follows it from where its log was. */
async function resume(rest: string[]): Promise<number> {
  const { values, positionals } = parse(rest, { ...answerOptions, detach: { type: "boolean" } });
  const runId = required(positionals, 0, "run-id");
  const session = await connect(values["data-dir"]);
  const { client } = session;
  const pending = (await client.inbox()).find((entry) => entry.run.id === runId);
  if (!pending) {
    const current = await client.runs.get(runId);
    throw new AppError("conflict", `Run ${runId} is ${current.status}, not waiting at a gate.`);
  }
  const interrupt = pickInterrupt(pending.interrupts, values.interrupt);
  const answer = buildAnswer(interrupt, values);
  const after = await printStoredEvents(client, runId, undefined);
  const resumed = await client.runs.resume(runId, answer, interrupt.id);
  if (values.detach) {
    if (values.json) printJson(resumed);
    return 0;
  }
  const final = await followRun(session, runId, {
    after,
    stopOnWaiting: true,
    json: !!values.json,
  });
  if (!values.json) printResumeHint(final);
  return exitCodeFor(final.status);
}

export function workflowsCommand([sub, ...rest]: string[]): Promise<number> {
  if (sub === "list") return list(rest);
  if (sub === "run") return run(rest);
  if (sub === "resume") return resume(rest);
  throw usageError(`Usage:\n${workflowsUsage}`);
}
