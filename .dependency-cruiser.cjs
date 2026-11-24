// Enforces the package layers in docs/architecture.md: a package may only
// import the packages listed for it here. Update this map when a package lands.
const allowed = {
  contracts: [],
  config: [],
  logger: ["contracts"],
  db: ["contracts", "logger"],
  "local-postgres": ["contracts", "logger"],
  "cli-bridge": ["contracts", "logger"],
  llm: ["contracts", "logger", "cli-bridge"],
  tools: ["contracts", "logger", "db", "cli-bridge"],
  graph: ["contracts", "logger", "db"],
  integrations: ["contracts", "logger", "db", "cli-bridge", "tools", "llm"],
  agents: ["contracts", "logger", "llm", "tools", "graph"],
  workflows: ["contracts", "logger", "agents", "llm", "tools", "graph"],
  chat: ["contracts", "logger", "agents", "workflows", "llm", "tools", "graph", "integrations"],
  core: [
    "contracts",
    "logger",
    "db",
    "local-postgres",
    "cli-bridge",
    "llm",
    "tools",
    "graph",
    "integrations",
    "agents",
    "workflows",
    "chat",
  ],
  client: ["contracts", "core"],
  ui: ["contracts"],
  // Test-only helpers (ephemeral Postgres, fakes). Only tests may import it.
  testing: ["contracts", "db", "local-postgres", "llm"],
};

/** Test files and their helpers (`src/test/`) may also import packages/testing. */
const TEST_FILES = "(\\.test\\.tsx?$|/src/test/)";

const layerRule = ([pkg, deps], tests) => ({
  name: tests ? `layer-${pkg}-tests` : `layer-${pkg}`,
  comment: `packages/${pkg} may only import: ${deps.join(", ") || "nothing"}${tests ? ", testing" : ""} (docs/architecture.md)`,
  severity: "error",
  from: tests
    ? { path: `^packages/${pkg}/.*${TEST_FILES}` }
    : { path: `^packages/${pkg}/`, pathNot: TEST_FILES },
  to: {
    path: "^packages/([^/]+)/",
    pathNot: [`^packages/(${[pkg, ...deps, ...(tests ? ["testing"] : [])].join("|")})/`],
  },
});
const layerRules = Object.entries(allowed).flatMap((entry) => [
  layerRule(entry, false),
  layerRule(entry, true),
]);

module.exports = {
  forbidden: [
    ...layerRules,
    {
      name: "testing-only-in-tests",
      comment: "packages/testing is for tests; app code never imports it.",
      severity: "error",
      from: { path: "^(packages|apps)/", pathNot: [TEST_FILES, "^packages/testing/"] },
      to: { path: "^packages/testing/" },
    },
    {
      name: "renderer-isolation",
      comment: "The renderer reaches the backend only through packages/client and packages/ui.",
      severity: "error",
      from: { path: "^apps/desktop/src/renderer/" },
      to: { path: "^packages/", pathNot: "^packages/(contracts|client|ui)/" },
    },
    {
      name: "desktop-main-layers",
      comment: "Electron main and preload never import UI or the client (docs/architecture.md).",
      severity: "error",
      from: { path: "^apps/desktop/src/(main|preload)/" },
      to: { path: "^(packages/(ui|client)/|apps/desktop/src/renderer/)" },
    },
    {
      name: "cli-layers",
      comment:
        "The CLI talks to Core through packages/client; it loads core only for `serve` and paths. Its tests may use packages/testing (testing-only-in-tests keeps it out of app code).",
      severity: "error",
      from: { path: "^apps/cli/" },
      to: {
        path: "^(packages/|apps/desktop/)",
        pathNot: "^packages/(contracts|client|core|testing)/",
      },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(node_modules|dist|out)/" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "types", "default"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".json"],
    },
  },
};
