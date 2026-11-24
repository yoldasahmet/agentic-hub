import type { GraphRuntime } from "@agentic/graph";
import { Hono } from "hono";
import type { AppEnv } from "../../http/env";

export const assistantRoutes = (graph: GraphRuntime) =>
  new Hono<AppEnv>().get("/", (c) => c.json(graph.registry.list()));
