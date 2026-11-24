import { runListQuerySchema } from "@agentic/contracts";
import { parse, required, usageError } from "../args";
import { connect } from "../connect";
import { EventPrinter } from "../events";
import { followRun, isTerminal, printStoredEvents } from "../follow";
import { printJson, table } from "../output";

export const runsUsage = `agentic runs list [--status S] [--limit N] [--json]
agentic runs logs <run-id> [--follow] [--json]`;

export async function runsCommand([sub, ...rest]: string[]): Promise<number> {
  if (sub === "list") {
    const { values } = parse(rest, { status: { type: "string" }, limit: { type: "string" } });
    const { client } = await connect(values["data-dir"]);
    const runs = await client.runs.list(
      runListQuerySchema.pick({ status: true, limit: true }).parse(values),
    );
    if (values.json) printJson(runs);
    else
      table(
        runs.map((r) => ({
          id: r.id,
          assistant: r.assistantId,
          status: r.status,
          created: r.createdAt.slice(0, 19).replace("T", " "),
        })),
        ["id", "assistant", "status", "created"],
      );
    return 0;
  }
  if (sub === "logs") {
    const { values, positionals } = parse(rest, { follow: { type: "boolean", short: "f" } });
    const runId = required(positionals, 0, "run-id");
    const session = await connect(values["data-dir"]);
    const json = !!values.json;
    const run = await session.client.runs.get(runId);
    // A finished run has nothing more to stream: print the stored log and stop.
    if (!values.follow || isTerminal(run.status)) {
      const printer = new EventPrinter(json);
      await printStoredEvents(session.client, runId, printer);
      printer.finish();
      return 0;
    }
    // Waiting runs are followed too: someone may answer the gate in the app.
    await followRun(session, runId, { stopOnWaiting: false, json });
    return 0;
  }
  throw usageError(`Usage:\n${runsUsage}`);
}
