import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";
import { contentSecurityPolicy } from "./csp.config";

/** Injects the CSP meta tag. Dev relaxes it only for Vite's HMR client and React Refresh. */
function cspPlugin(): Plugin {
  return {
    name: "agentic-csp",
    transformIndexHtml(html, ctx) {
      const csp = contentSecurityPolicy({ dev: ctx.server !== undefined });
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

/** Copies the SQL migrations next to the main bundle, where the migrator reads them. */
function migrationsPlugin(): Plugin {
  const source = fileURLToPath(new URL("../../packages/db/drizzle", import.meta.url));
  return {
    name: "agentic-migrations",
    async writeBundle(options) {
      if (options.dir) await cp(source, `${options.dir}/migrations`, { recursive: true });
    },
  };
}

export default defineConfig({
  main: {
    plugins: [migrationsPlugin()],
    build: {
      // Only `dependencies` stay external and ship in the packaged app's
      // node_modules: `ws` loads optional native helpers at runtime, `node-pty`
      // is native, and electron-updater reads its own files. Everything else
      // (workspace packages, which ship TypeScript source) is a devDependency
      // and gets bundled.
      externalizeDeps: true,
      // pg loads its optional native driver lazily. Hoisting Vite's missing-peer
      // stub would crash development startup even when using the JS driver.
      commonjsOptions: { ignore: ["pg-native"] },
      // Core runs in its own utilityProcess (D3), from out/main/core.js.
      rollupOptions: { input: { index: "src/main/index.ts", core: "src/core/index.ts" } },
    },
  },
  preload: {
    // Sandboxed preloads must be a single CommonJS file with no imports.
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss(), cspPlugin()],
  },
});
