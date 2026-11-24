import { type CoreClient, CoreSocket, createCoreClient } from "@agentic/client";
import { AppError, type AuthStatus } from "@agentic/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import { useCoreStatus } from "../shell/queries";
import { useAuthSession } from "./auth-session";

export type CoreHandle = { client: CoreClient; socket: CoreSocket; key: string };

/** Sign-in state for the shell: the sign-in screen needs a client before anyone is signed in. */
export type AuthGate = {
  client: CoreClient;
  status: AuthStatus;
  setSession(token: string | null): Promise<void>;
};

const CoreContext = createContext<CoreHandle | undefined>(undefined);
const AuthContext = createContext<AuthGate | undefined>(undefined);

/**
 * Connects the renderer to Core once main reports it ready and someone is
 * signed in (or the local DB signs in automatically). A Core restart or a
 * new session brings a new key, so the client, socket, and every
 * `["core", key, …]` query are replaced with it.
 */
export function CoreProvider({ children }: { children: ReactNode }) {
  const status = useCoreStatus().data;
  const { session, loaded, setSession } = useAuthSession();
  const queryClient = useQueryClient();
  const url = status?.state === "ready" ? status.url : undefined;
  const token = status?.state === "ready" ? status.token : undefined;

  const connection = useMemo(() => {
    if (!url || !token || !loaded) return undefined;
    const conn = { url, token, session: session ?? undefined };
    // The key must change with the user, never contain the whole token.
    return { conn, client: createCoreClient(conn), key: `${url}#${session?.slice(-8) ?? "auto"}` };
  }, [url, token, session, loaded]);

  const auth = useQuery({
    queryKey: ["core", connection?.key, "auth", "status"],
    queryFn: () => {
      if (!connection) throw new AppError("unavailable", "Core is not ready");
      return connection.client.auth.status();
    },
    enabled: connection !== undefined,
    retry: false,
  });
  const staleSession = auth.error instanceof AppError && auth.error.code === "auth.session_invalid";
  useEffect(() => {
    if (staleSession) void setSession(null);
  }, [staleSession, setSession]);

  const authStatus = auth.data;
  const signedIn = authStatus?.user != null;
  const handle = useMemo(() => {
    if (!connection || !signedIn) return undefined;
    const socket = new CoreSocket(connection.conn);
    return { client: connection.client, socket, key: connection.key };
  }, [connection, signedIn]);

  useEffect(() => {
    if (!handle) return;
    // Any run change can touch lists, thread state, and the Inbox.
    const stop = handle.socket.watchRuns(() =>
      queryClient.invalidateQueries({ queryKey: ["core", handle.key] }),
    );
    return () => {
      stop();
      handle.socket.close();
    };
  }, [handle, queryClient]);

  const gate = useMemo(
    () =>
      connection && authStatus
        ? { client: connection.client, status: authStatus, setSession }
        : undefined,
    [connection, authStatus, setSession],
  );

  return (
    <AuthContext value={gate}>
      <CoreContext value={handle}>{children}</CoreContext>
    </AuthContext>
  );
}

export function useCore(): CoreHandle | undefined {
  return useContext(CoreContext);
}

export function useAuthGate(): AuthGate | undefined {
  return useContext(AuthContext);
}
