import type { Server } from "node:http";
import type { Duplex } from "node:stream";
import { AppError } from "@agentic/contracts";
import type { GraphRuntime } from "@agentic/graph";
import { WebSocketServer } from "ws";
import { isTrustedOrigin, tokenMatches } from "../http/auth";
import type { AuthSessionService } from "../modules/auth/session-service";
import type { TerminalService } from "../modules/terminals/service";
import { serveConnection } from "./connection";

type Deps = {
  graph: GraphRuntime;
  terminals: TerminalService;
  auth: AuthSessionService;
  token: string;
};

/**
 * Accepts `GET /ws?token=…&session=…` upgrades. Browsers can't set headers
 * on a WebSocket, so both travel in the query string; Core only listens on
 * loopback and never logs URLs. The socket acts as the session's user (or
 * the local DB's auto sign-in) for its whole life.
 */
export function attachWsHub(
  server: Server,
  { graph, terminals, auth, token }: Deps,
): () => Promise<void> {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/ws") return reject(socket, 404, "Not Found");
    const loopback = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? "");
    if (!loopback || !isTrustedOrigin(req.headers.origin)) {
      return reject(socket, 403, "Forbidden");
    }
    if (!tokenMatches(token, url.searchParams.get("token"))) {
      return reject(socket, 401, "Unauthorized");
    }
    auth.resolve(url.searchParams.get("session") || undefined).then(
      (principal) => {
        if (!principal) return reject(socket, 401, "Unauthorized");
        wss.handleUpgrade(req, socket, head, (ws) =>
          serveConnection(ws, graph, terminals, principal.ctx),
        );
      },
      (err: unknown) => {
        const unauthorized = err instanceof AppError && err.code.startsWith("auth.");
        reject(socket, unauthorized ? 401 : 500, unauthorized ? "Unauthorized" : "Error");
      },
    );
  });
  return () =>
    new Promise((resolve) => {
      for (const client of wss.clients) client.terminate();
      wss.close(() => resolve());
    });
}

function reject(socket: Duplex, status: number, text: string): void {
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`);
}
