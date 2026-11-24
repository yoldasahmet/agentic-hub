import { serveOverPort } from "@agentic/core";

// Entry of the Core utilityProcess (electron.vite.config.ts bundles it as out/main/core.js).
// Main sends the start config over this port; see packages/core/src/embed/port-host.ts.
serveOverPort(process.parentPort, process.env.AGENTIC_APP_VERSION ?? "0.0.0");
