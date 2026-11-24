import { AppError } from "@agentic/contracts";
import { agentsCommand, agentsUsage } from "./commands/agents";
import { doctorCommand, doctorUsage } from "./commands/doctor";
import { loginCommand, loginUsage, logoutCommand, logoutUsage } from "./commands/login";
import { runsCommand, runsUsage } from "./commands/runs";
import { serveCommand, serveUsage } from "./commands/serve";
import { statusCommand, statusUsage } from "./commands/status";
import { threadsCommand, threadsUsage } from "./commands/threads";
import { workflowsCommand, workflowsUsage } from "./commands/workflows";
import { describeError, print, red } from "./output";
import { cliVersion } from "./version";

type Command = { run: (args: string[]) => Promise<number>; usage: string };

const commands: Record<string, Command> = {
  status: { run: statusCommand, usage: statusUsage },
  doctor: { run: doctorCommand, usage: doctorUsage },
  login: { run: loginCommand, usage: loginUsage },
  logout: { run: logoutCommand, usage: logoutUsage },
  agents: { run: agentsCommand, usage: agentsUsage },
  workflows: { run: workflowsCommand, usage: workflowsUsage },
  runs: { run: runsCommand, usage: runsUsage },
  threads: { run: threadsCommand, usage: threadsUsage },
  serve: { run: serveCommand, usage: serveUsage },
};

const help = `agentic ${cliVersion}: drive Agentic Hub from the terminal.

${Object.values(commands)
  .map((c) => c.usage)
  .join("\n")}

Every command takes --data-dir DIR (where to find runtime/core.json) and
--json. AGENTIC_URL + AGENTIC_TOKEN connect to a Core started elsewhere;
AGENTIC_SESSION signs in there. A team DB needs \`agentic login\` first.
Run commands exit 0 when the run succeeds, 3 when it waits at a gate, and
1 when it fails or is canceled.`;

async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  if (name === "--version" || name === "-v") {
    print(cliVersion);
    return 0;
  }
  if (!name || name === "help" || name === "--help" || name === "-h") {
    print(help);
    return 0;
  }
  const command = commands[name];
  if (!command) throw new AppError("validation_failed", `Unknown command "${name}".\n\n${help}`);
  if (rest.includes("--help") || rest.includes("-h")) {
    print(command.usage);
    return 0;
  }
  return command.run(rest);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`${red("error")} ${describeError(err)}\n`);
    process.exitCode = 1;
  },
);
