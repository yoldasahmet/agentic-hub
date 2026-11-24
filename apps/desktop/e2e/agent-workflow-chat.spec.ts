import {
  agentSchema,
  agentVersionSchema,
  fieldsToSchema,
  type IoField,
  runSchema,
  savedWorkflowSchema,
  workflowSchema,
  workflowVersionSchema,
} from "@agentic/contracts";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { type LaunchedApp, launchApp } from "./app";

const field = (name: string, required = true): IoField => ({
  name,
  type: "text",
  description: "",
  required,
});

let launched: LaunchedApp;
test.beforeAll(async () => {
  launched = await launchApp();
});
test.afterAll(async () => {
  await launched?.close();
});

/**
 * The whole loop on a fresh profile: an agent, a workflow that uses it,
 * a chat run of that workflow, its gates answered inline, and the result.
 * The agent is `human`, so no LLM CLI or API key is needed.
 */
test("agent → workflow → chat run → gate → result", async () => {
  const { api, page } = launched;

  const agent = await api(agentSchema, "POST", "/agents", {
    name: "E2E Reviewer",
    spec: {
      kind: "human",
      inputSchema: fieldsToSchema([field("task")]),
      outputSchema: fieldsToSchema([field("answer")]),
      prompt: { system: "", template: "Review: {{input.task}}" },
    },
  });
  await api(agentVersionSchema, "POST", `/agents/${agent.id}/publish`, {
    revision: agent.revision,
  });

  const workflow = await api(workflowSchema, "POST", "/workflows", { name: "E2E Ship" });
  const saved = await api(savedWorkflowSchema, "PATCH", `/workflows/${workflow.id}`, {
    revision: workflow.revision,
    draft: {
      inputSchema: fieldsToSchema([field("task")]),
      outputSchema: fieldsToSchema([field("result", false)]),
      outputs: { result: { kind: "node", node: "approve", field: "answer" } },
      nodes: [
        {
          kind: "agent",
          id: "review",
          agentId: agent.id,
          bindings: { task: { kind: "input", field: "task" } },
        },
        {
          kind: "gate",
          id: "approve",
          title: "Ship it?",
          schema: fieldsToSchema([field("answer")]),
          bindings: { answer: { kind: "node", node: "review", field: "answer" } },
        },
      ],
      edges: [{ id: "e1", from: "review", to: "approve" }],
    },
  });
  expect(saved.issues).toEqual([]);
  await api(workflowVersionSchema, "POST", `/workflows/${workflow.id}/publish`, {
    revision: saved.revision,
  });

  // Setup used the API outside React Query. Refresh the picker after publishing.
  await page.reload();
  await page.getByRole("button", { name: "Start a chat" }).click();
  await expect(page.getByRole("heading", { name: "New chat" })).toBeVisible();
  await page.getByRole("button", { name: /E2E Ship/ }).click();
  const composer = page.getByPlaceholder(/Message…/);
  await composer.fill("Ship the login fix");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  // The chat may ask for the workflow's inputs before it runs.
  const task = page.getByLabel(/^task/);
  if (await task.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await task.fill("Ship the login fix");
    await page.getByRole("button", { name: /^(Run|Start|Submit)/ }).click();
  }

  // The human agent's question, answered inline.
  await expect(page.getByText(/Review: Ship the login fix/)).toBeVisible();
  await page.getByLabel(/^answer/).fill("LGTM");
  await page.getByRole("button", { name: "Answer" }).click();

  // The workflow gate, approved inline.
  await expect(page.getByText("Ship it?")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByText("LGTM").last()).toBeVisible();
  await expect
    .poll(async () => {
      const runs = await api(z.array(runSchema), "GET", "/runs?status=succeeded");
      return runs.length;
    })
    .toBeGreaterThan(0);
});
