import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import {
  type CoreDbInfo,
  type CoreRuntimeInfo,
  type CoreSecrets,
  type CoreStartConfig,
  PROVIDER_SECRETS,
} from "@agentic/contracts";
import {
  bootstrapLocalWorkspace,
  defaultMigrationsFolder,
  describeTarget,
  migrateDatabase,
  openDatabase,
  poolConfig,
} from "@agentic/db";
import { AssistantRegistry, createGraphRuntime, sampleAssistant } from "@agentic/graph";
import { createDefaultProviders, type LlmProvider } from "@agentic/llm";
import { moduleLogger } from "@agentic/logger";
import { createApp } from "./app";
import { createAgentModule } from "./modules/agents/index";
import { createAuthModule } from "./modules/auth/index";
import { createChatModule } from "./modules/chats/index";
import { createGithubModule } from "./modules/github/index";
import { createJiraModule } from "./modules/jira/index";
import { ModelRepository } from "./modules/llm/repository";
import { LlmService } from "./modules/llm/service";
import { TerminalService } from "./modules/terminals/service";
import { createToolModule } from "./modules/tools/index";
import { terminalExtras } from "./modules/tools/terminal-extras";
import { createTriggerModule } from "./modules/triggers/index";
import { createWorkflowModule } from "./modules/workflows/index";
import { removeRuntimeFile, writeRuntimeFile } from "./runtime/runtime-file";
import { SecretStore } from "./runtime/secret-store";
import { listen } from "./server";
import { attachWsHub } from "./ws/ws-hub";

const log = moduleLogger("core");

export type CoreInstance = {
  info: CoreRuntimeInfo;
  db: CoreDbInfo;
  migrate(): Promise<number>;
  setSecrets(secrets: CoreSecrets): void;
  stop(): Promise<void>;
};

/**
 * `openRouterBaseUrl` and `githubApiUrl` point those APIs at a stand-in (tests,
 * proxies, GitHub Enterprise). `storeSecret` keeps a secret Core obtained
 * (a GitHub device sign-in) in the vault; without it the secret stays in memory.
 * `extraProviders` registers providers next to the defaults (tests use a scripted one).
 */
export type CoreOptions = {
  version: string;
  port?: number;
  openRouterBaseUrl?: string;
  githubApiUrl?: string;
  storeSecret?(name: string, value: string): void;
  extraProviders?: readonly LlmProvider[];
};

/**
 * Starts the embedded backend: connects, migrates under the advisory lock,
 * bootstraps the workspace, starts the LangGraph host and job worker, and
 * serves HTTP + WS on loopback. Electron and plain Node share this entry.
 */
export async function startCore(
  config: CoreStartConfig,
  options: CoreOptions,
): Promise<CoreInstance> {
  const migrationsFolder = config.migrationsFolder ?? defaultMigrationsFolder;
  const handle = openDatabase(config.db);
  const cleanup: Array<() => Promise<void>> = [() => handle.close()];
  let stopping: Promise<void> | undefined;
  const stop = () => {
    stopping ??= (async () => {
      log.info("core stopping");
      for (const step of [...cleanup].reverse()) {
        await step().catch((err: unknown) => log.warn({ err }, "shutdown step failed"));
      }
    })();
    return stopping;
  };
  try {
    log.info({ version: options.version, db: describeTarget(config.db) }, "core starting");
    const version = await handle.pool.query<{ server_version: string }>("show server_version");
    const { applied } = await migrateDatabase(handle.pool, migrationsFolder);
    log.info({ serverVersion: version.rows[0]?.server_version, applied }, "database ready");
    await bootstrapLocalWorkspace(handle.db);
    const auth = createAuthModule(handle.db, config.db.mode);

    const registry = new AssistantRegistry();
    registry.register(sampleAssistant);
    const graph = await createGraphRuntime({
      handle,
      connection: poolConfig(config.db),
      registry,
      host: hostname(),
    });
    cleanup.push(() => graph.stop());

    const secrets = new SecretStore(config.secrets);
    const providers = createDefaultProviders({
      getOpenRouterKey: () => secrets.get(PROVIDER_SECRETS.openrouterApiKey),
      openRouterBaseUrl: options.openRouterBaseUrl,
    });
    for (const provider of options.extraProviders ?? []) providers.registry.register(provider);
    const scratchDir = join(config.dataDir, "llm-scratch");
    await mkdir(scratchDir, { recursive: true, mode: 0o700 });
    const models = new ModelRepository(handle.db);
    const llm = new LlmService(providers, models, scratchDir);
    const gitRoot = join(config.dataDir, "git");
    const tools = createToolModule({
      db: handle.db,
      scratchDir,
      version: options.version,
      secrets,
      managedDirs: [join(gitRoot, "worktrees")],
    });
    cleanup.push(() => tools.close());
    const jira = createJiraModule({
      db: handle.db,
      version: options.version,
      secrets,
      registry: tools.registry,
    });
    const github = createGithubModule({
      db: handle.db,
      gitRoot,
      scratchDir,
      version: options.version,
      secrets,
      registry: tools.registry,
      guardrails: (workspaceId) => tools.guardrails.get(workspaceId),
      apiUrl: options.githubApiUrl,
      storeSecret: options.storeSecret,
      onPullOpened: jira.linkPull,
    });
    cleanup.push(() => github.close());
    const agents = createAgentModule({
      db: handle.db,
      graph,
      providers: providers.registry,
      pricing: async ({ providerId, model }) =>
        providers.catalog.find(providerId, model)?.pricing ??
        (await models.anyPricing(providerId, model)),
      scratchDir,
      tools: tools.toolbox,
      worktrees: github.worktrees,
      skills: tools.skills,
    });

    const workflows = createWorkflowModule({
      db: handle.db,
      graph,
      agents,
      runtime: agents.runtime,
      tools,
    });
    const triggers = createTriggerModule(handle.db, graph, workflows, github.conn, jira.conn);
    const chats = createChatModule({
      db: handle.db,
      graph,
      agents,
      workflows,
      llm,
      runtime: agents.runtime,
      tools: [...github.appTools, ...jira.appTools],
    });

    const terminals = new TerminalService(
      async (ctx, chatId) => (await chats.service.get(ctx, chatId)).workingDir,
      terminalExtras(tools.toolbox),
    );
    cleanup.push(async () => terminals.stopAll());

    const token = randomBytes(32).toString("hex");
    const modules = {
      graph,
      llm,
      agents,
      workflows,
      triggers,
      chats,
      terminals,
      tools,
      github,
      jira,
    };
    const http = await listen(
      createApp({ ...modules, auth, token, version: options.version }),
      options.port,
    );
    cleanup.push(() => http.close());
    cleanup.push(attachWsHub(http.server, { graph, terminals, auth: auth.sessions, token }));
    await graph.start();

    const info: CoreRuntimeInfo = {
      url: `http://127.0.0.1:${http.port}`,
      port: http.port,
      token,
      pid: process.pid,
      version: options.version,
      startedAt: new Date().toISOString(),
    };
    await writeRuntimeFile(config.dataDir, info);
    cleanup.push(() => removeRuntimeFile(config.dataDir, process.pid));
    log.info({ url: info.url, pid: info.pid }, "core ready");

    return {
      info,
      db: {
        target: describeTarget(config.db),
        serverVersion: version.rows[0]?.server_version ?? "unknown",
        migrationsApplied: applied,
      },
      migrate: async () => (await migrateDatabase(handle.pool, migrationsFolder)).applied,
      setSecrets: (next) => secrets.replace(next),
      stop,
    };
  } catch (err) {
    log.error({ err }, "core failed to start");
    await stop();
    throw err;
  }
}
