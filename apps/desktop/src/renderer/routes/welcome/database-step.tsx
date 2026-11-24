import { PRODUCT_NAME } from "@agentic/contracts";
import { Button } from "@agentic/ui";
import { Link } from "@tanstack/react-router";
import { useDatabaseStatus } from "../../shell/queries";
import { SetupStep, type StepState } from "./setup-step";

/** The database the app starts on: the bundled local service unless a team DB is set. */
export function DatabaseStep() {
  const { data: status } = useDatabaseStatus();
  const state: StepState =
    status?.state === "ready" ? "done" : status?.state === "error" ? "problem" : "checking";
  const where =
    status?.settings.mode === "remote" ? "your team database" : "the local database on this Mac";
  return (
    <SetupStep
      number={1}
      title="Database"
      state={state}
      description={
        state === "done"
          ? `${PRODUCT_NAME} stores agents, workflows, runs, and chats in ${where}.`
          : state === "problem"
            ? (status?.error ?? "The database didn't start.")
            : "Creating and starting the local database. The first launch takes a few seconds."
      }
    >
      <div>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/settings/database">Use a team database instead…</Link>
        </Button>
      </div>
    </SetupStep>
  );
}
