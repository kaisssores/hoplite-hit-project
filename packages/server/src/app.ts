import { fileURLToPath } from "node:url";
import { API_PREFIX, TETHER_VERSION } from "@tether/contract";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HttpError } from "./errors.ts";
import { catalogRoutes } from "./routes/catalog.ts";
import { eventRoutes } from "./routes/event.ts";
import { keyRoutes } from "./routes/keys.ts";
import { sessionRoutes } from "./routes/sessions.ts";
import { settingsRoutes } from "./routes/settings.ts";
import type { Runtime } from "./runtime.ts";
import { serveClient } from "./static.ts";

const CLIENT_DIST = fileURLToPath(new URL("../../app/dist", import.meta.url));

export interface AppOptions {
  /** Directory holding the built web client. Defaults to `packages/app/dist`. */
  clientDir?: string;
}

/** The HTTP surface. Handlers only validate and call into the store, the runner and the adapters. */
export function createApp(rt: Runtime, options: AppOptions = {}): Hono {
  const clientDir = options.clientDir ?? CLIENT_DIST;
  const app = new Hono();

  app.use(
    `${API_PREFIX}/*`,
    cors({ origin: "*", allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowHeaders: ["content-type", "x-tether-session"] }),
  );

  const v1 = new Hono();
  v1.route("/", catalogRoutes(rt));
  v1.route("/", keyRoutes(rt));
  v1.route("/", sessionRoutes(rt));
  v1.route("/", settingsRoutes(rt));
  v1.route("/", eventRoutes(rt));
  app.route(API_PREFIX, v1);

  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: { code: error.code, message: error.message } }, error.status);
    console.error("tether: unhandled error", error);
    return c.json({ error: { code: "internal_error", message: "The server could not handle this request" } }, 500);
  });

  app.notFound(async (c) => {
    const { pathname } = new URL(c.req.url);
    if (!pathname.startsWith(`${API_PREFIX}/`) && (c.req.method === "GET" || c.req.method === "HEAD")) {
      const page = await serveClient(clientDir, pathname);
      if (page) return page;
      if (pathname === "/") return c.json({ name: "tether", version: TETHER_VERSION, doc: `${API_PREFIX}/doc` });
    }
    return c.json({ error: { code: "not_found", message: `No route matches ${c.req.method} ${pathname}` } }, 404);
  });

  rt.self = (path, init) => app.request(path, init);
  return app;
}
