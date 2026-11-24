import {
  AppError,
  gateAnswerSchema,
  type Interrupt,
  type JsonValue,
  jsonValueSchema,
  toolApprovalAnswerSchema,
} from "@agentic/contracts";
import { z } from "zod";
import { parseJson, usageError } from "./args";
import { describeInterrupt } from "./events";

export const answerOptions = {
  approve: { type: "boolean" },
  reject: { type: "boolean" },
  answer: { type: "string" },
  data: { type: "string" },
  comment: { type: "string" },
  interrupt: { type: "string" },
} as const;

type AnswerFlags = {
  approve?: boolean;
  reject?: boolean;
  answer?: string;
  data?: string;
  comment?: string;
  interrupt?: string;
};

const kindSchema = z.object({ kind: z.string() });

/** The gate to answer: the one named by `--interrupt`, or the only one waiting. */
export function pickInterrupt(interrupts: Interrupt[], id: string | undefined): Interrupt {
  if (id) {
    const found = interrupts.find((i) => i.id === id);
    if (!found) throw new AppError("not_found", `No waiting gate with id "${id}".`);
    return found;
  }
  const [only, ...others] = interrupts;
  if (!only) throw new AppError("conflict", "This run has no waiting gate.");
  if (others.length > 0) {
    const list = interrupts.map((i) => `  ${describeInterrupt(i)}`).join("\n");
    throw usageError(`Several gates are waiting; pick one with --interrupt <id>:\n${list}`);
  }
  return only;
}

/**
 * The resume value, shaped for the gate's kind: workflow gates and reviews
 * take `{ action, data?, comment? }`, tool approvals `{ approved, note? }`.
 * `--answer` sends any JSON as is, for gates the CLI doesn't know.
 */
export function buildAnswer(interrupt: Interrupt, flags: AnswerFlags): JsonValue {
  if (flags.answer !== undefined) return parseJson(flags.answer, "--answer");
  if (flags.approve === flags.reject)
    throw usageError("Pass exactly one of --approve, --reject, or --answer '<json>'.");
  const approved = flags.approve === true;
  const kind = kindSchema.safeParse(interrupt.value).data?.kind;
  if (kind === "tool.approval") {
    return jsonValueSchema.parse(toolApprovalAnswerSchema.parse({ approved, note: flags.comment }));
  }
  if (kind === "workflow.gate" || kind === "workflow.review") {
    const data = flags.data === undefined ? undefined : parseJson(flags.data, "--data");
    return jsonValueSchema.parse(
      gateAnswerSchema.parse({
        action: approved ? "approve" : "reject",
        data,
        comment: flags.comment,
      }),
    );
  }
  throw usageError(`This gate (${kind ?? "custom"}) needs --answer '<json>'.`);
}
