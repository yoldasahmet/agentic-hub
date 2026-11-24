import { startHeadlessCore, stopOnSignals } from "../headless";

/** Headless Core under plain Node (`pnpm --filter @agentic/core start`); see headless.ts for the env. */
async function main(): Promise<void> {
  const core = await startHeadlessCore(process.env, process.env.npm_package_version ?? "0.0.0");
  console.log(`Core listening on ${core.info.url} (pid ${core.info.pid})`);
  stopOnSignals(core);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
