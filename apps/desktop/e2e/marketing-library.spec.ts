import { agentSchema } from "@agentic/contracts";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { launchApp } from "./app";

test("opens one library agent and resolves archived agents in a workflow", async () => {
  const { api, page, close } = await launchApp();
  try {
    const agentsLink = page.getByRole("link", { name: "Agents", exact: true });
    await agentsLink.click();
    const library = page.getByRole("button", { name: "Library", exact: true }).first();
    await library.click();
    const strategist = page.getByRole("listitem").filter({ hasText: "Marketing Strategist" });
    await strategist.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByLabel("Agent name")).toHaveValue("Marketing Strategist");
    const editorUrl = page.url();

    await agentsLink.click();
    await library.click();
    await strategist.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page).toHaveURL(editorUrl);
    expect(await api(z.array(agentSchema), "GET", "/agents")).toHaveLength(1);

    await page.getByRole("link", { name: "Workflows", exact: true }).click();
    await page.getByRole("button", { name: "Templates", exact: true }).first().click();
    await page
      .getByRole("listitem")
      .filter({ hasText: "Marketing Campaign Draft" })
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await expect(page.getByLabel("Workflow name")).toHaveValue("Marketing Campaign Draft");
    const workflowUrl = page.url();

    const agents = await api(z.array(agentSchema), "GET", "/agents");
    const copywriter = agents.find((agent) => agent.slug === "marketing-copywriter");
    if (!copywriter) throw new Error("The workflow did not install its copywriter");
    await api(agentSchema, "POST", `/agents/${copywriter.id}/archive`, { archived: true });

    await agentsLink.click();
    await page.reload();
    await expect(page.getByText("Marketing Editor", { exact: true })).toBeVisible();
    await expect(page.getByText("Marketing Copywriter", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Workflows", exact: true }).click();
    await page.getByRole("link", { name: /Marketing Campaign Draft/ }).click();
    await expect(page).toHaveURL(workflowUrl);
    await expect(page.getByText("Marketing Copywriter", { exact: true })).toHaveCount(0);
    await page.getByText("Write copy", { exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Version" })).toHaveText(
      "Latest published (v1)",
    );
    await expect(page.getByText("Marketing Copywriter", { exact: true })).toBeVisible();
  } finally {
    await close();
  }
});
