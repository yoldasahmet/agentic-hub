import { Outlet } from "@tanstack/react-router";
import { CoreProvider, useAuthGate } from "../lib/core";
import { SignInScreen } from "../routes/auth/sign-in-screen";
import { AppCommandPalette } from "./app-command-palette";
import { useCoreStatusEvents, useDatabaseStatusEvents } from "./queries";
import { Sidebar } from "./sidebar";
import { StatusBar } from "./status-bar";
import { TitleBar } from "./title-bar";
import { useMenuCommands } from "./use-menu-commands";

export function AppLayout() {
  useMenuCommands();
  useDatabaseStatusEvents();
  useCoreStatusEvents();

  return (
    <CoreProvider>
      <div className="flex h-full flex-col bg-canvas">
        <TitleBar />
        <Body />
        <StatusBar />
      </div>
    </CoreProvider>
  );
}

/** The app, or the sign-in screen while nobody is signed in (P17). */
function Body() {
  const gate = useAuthGate();
  if (gate && !gate.status.user) return <SignInScreen gate={gate} />;
  return (
    <>
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden border-l border-border bg-canvas">
          <Outlet />
        </main>
      </div>
      <AppCommandPalette />
    </>
  );
}
