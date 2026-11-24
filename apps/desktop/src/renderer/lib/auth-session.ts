import { toast } from "@agentic/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { invoke } from "./bridge";

const sessionKey = ["auth-session"] as const;

/**
 * The signed-in session token. Main keeps it in the vault across restarts;
 * if the vault can't save it, the session still works until the app quits.
 */
export function useAuthSession() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: async () => (await invoke("auth.session", undefined)).token,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const setSession = useCallback(
    async (token: string | null) => {
      queryClient.setQueryData(sessionKey, token);
      await invoke("auth.setSession", { token }).catch(() =>
        toast.warning("Signed in until the app quits", {
          description: "The Keychain couldn't save your session.",
        }),
      );
    },
    [queryClient],
  );
  return { session: query.data, loaded: query.isFetched, setSession };
}
