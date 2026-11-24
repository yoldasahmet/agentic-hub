import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    // Local IPC is cheap and the window focus event is noisy on macOS.
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});
