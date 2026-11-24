import { PRODUCT_NAME } from "@agentic/contracts";
import { Button } from "@agentic/ui";
import { useNavigate } from "@tanstack/react-router";
import { markFirstRunDone } from "../../lib/first-run";
import { DatabaseStep } from "./database-step";
import { IntegrationsStep } from "./integrations-step";
import { ProvidersStep } from "./providers-step";
import { TemplatesStep } from "./templates-step";

/**
 * First-run setup (P18.6). Opens on the first launch and stays reachable
 * from Settings → General. Every step can be done later in Settings.
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const finish = () => {
    markFirstRunDone();
    void navigate({ to: "/chats" });
  };
  return (
    <div className="h-full overflow-y-auto">
      <section className="mx-auto grid max-w-2xl gap-6 px-6 py-10">
        <header className="grid gap-1">
          <h2 className="font-serif text-2xl">Welcome to {PRODUCT_NAME}</h2>
          <p className="text-fg-muted">
            A few things to check before your first agent. Everything here can be changed later in
            Settings.
          </p>
        </header>
        <ol className="grid gap-3">
          <DatabaseStep />
          <ProvidersStep />
          <IntegrationsStep />
          <TemplatesStep />
        </ol>
        <footer className="flex justify-end gap-2">
          <Button variant="ghost" onClick={finish}>
            Skip for now
          </Button>
          <Button variant="primary" onClick={finish}>
            Start a chat
          </Button>
        </footer>
      </section>
    </div>
  );
}
