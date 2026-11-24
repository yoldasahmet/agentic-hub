import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import type { Hono } from "hono";

export type Listening = { server: Server; port: number; close(): Promise<void> };

/** Listens on 127.0.0.1 with a free port picked by the OS (D9). */
export function listen(app: Hono, port = 0): Promise<Listening> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
    if (!isHttpServer(server)) return reject(new Error("Core needs an HTTP/1.1 server"));
    server.once("error", reject);
    server.once("listening", () => {
      const address: AddressInfo | string | null = server.address();
      if (!address || typeof address === "string") return reject(new Error("No TCP address"));
      resolve({
        server,
        port: address.port,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

function isHttpServer(server: unknown): server is Server {
  return typeof server === "object" && server !== null && "closeAllConnections" in server;
}
