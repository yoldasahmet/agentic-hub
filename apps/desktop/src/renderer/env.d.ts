import type { AppBridge } from "@agentic/contracts";

declare global {
  interface Window {
    /** Exposed by the preload script (src/preload/index.ts). */
    app: AppBridge;
  }
}
