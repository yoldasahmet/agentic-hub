import { stateValuesSchema } from "@agentic/contracts";
import { parse, parseJson, required, usageError } from "../args";
import { connect } from "../connect";
import { bold, dim, print, printJson } from "../output";

export const threadsUsage = `agentic threads state get <thread-id> [--json]
agentic threads state set <thread-id> --values '{…}' [--as-node node] [--checkpoint id] [--json]`;

/** `threads state get|set`: the latest checkpoint, and edits that write a new one. */
export async function threadsCommand([group, sub, ...rest]: string[]): Promise<number> {
  if (group !== "state" || (sub !== "get" && sub !== "set"))
    throw usageError(`Usage:\n${threadsUsage}`);
  const { values, positionals } = parse(rest, {
    values: { type: "string" },
    "as-node": { type: "string" },
    checkpoint: { type: "string" },
  });
  const threadId = required(positionals, 0, "thread-id");
  const { client } = await connect(values["data-dir"]);
  let result: Awaited<ReturnType<typeof client.threads.state>>;
  if (sub === "get") {
    result = await client.threads.state(threadId);
  } else {
    if (values.values === undefined) throw usageError("threads state set needs --values '{…}'.");
    result = await client.threads.updateState(threadId, {
      values: stateValuesSchema.parse(parseJson(values.values, "--values")),
      asNode: values["as-node"],
      checkpointId: values.checkpoint,
    });
  }
  if (values.json) {
    printJson(result);
    return 0;
  }
  const { thread, state } = result;
  print(`${bold("thread")}      ${thread.id} ${dim(`(${thread.status})`)}`);
  print(`${bold("assistant")}   ${thread.assistantId} v${thread.assistantVersion}`);
  if (!state) {
    print(dim("No checkpoint yet."));
    return 0;
  }
  print(`${bold("checkpoint")}  ${state.checkpointId} ${dim(`step ${state.step}`)}`);
  if (state.next.length > 0) print(`${bold("next")}        ${state.next.join(", ")}`);
  for (const i of state.interrupts)
    print(`${bold("waiting")}     ${i.node} ${dim(`(id ${i.id})`)}`);
  print(bold("values"));
  print(JSON.stringify(state.values, null, 2));
  return 0;
}
