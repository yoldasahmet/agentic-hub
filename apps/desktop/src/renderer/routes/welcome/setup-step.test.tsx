import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { isFirstRunDone, markFirstRunDone } from "../../lib/first-run";
import { SetupStep } from "./setup-step";

afterEach(() => localStorage.clear());

describe("SetupStep", () => {
  it("shows the state as icon and label, and marks optional steps", () => {
    render(
      <SetupStep
        number={3}
        title="GitHub and Jira"
        description="Connect them."
        state="done"
        optional
      >
        <button type="button">Connect…</button>
      </SetupStep>,
    );
    expect(screen.getByRole("heading", { name: "GitHub and Jira" })).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Optional")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect…" })).toBeTruthy();
  });

  it("says when a step needs attention", () => {
    render(<SetupStep number={1} title="Database" description="It failed." state="problem" />);
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.queryByText("Optional")).toBeNull();
  });
});

describe("first-run flag", () => {
  it("is unset on a new install and remembered once set", () => {
    expect(isFirstRunDone()).toBe(false);
    markFirstRunDone();
    expect(isFirstRunDone()).toBe(true);
  });
});
