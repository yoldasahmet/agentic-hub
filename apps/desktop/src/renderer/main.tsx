import { Toaster, TooltipProvider } from "@agentic/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { AppErrorBoundary } from "./components/app-error-boundary";
import { queryClient } from "./lib/query-client";
import { installErrorReporting } from "./lib/report-error";
import { router } from "./router";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
installErrorReporting();

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
