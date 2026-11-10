import { ROUTES } from "@tether/contract";
import { Hono } from "hono";
import { HttpError, notFound } from "../errors.ts";
import { buildRegisteredApi } from "../register.ts";
import { serverInfo, type Runtime } from "../runtime.ts";
import { readJson } from "./http.ts";

export function catalogRoutes(rt: Runtime): Hono {
  const { store, health } = rt;
  const app = new Hono();

  app.get("/server", (c) => c.json(serverInfo(rt)));
  app.get("/doc", (c) => c.json(ROUTES));

  app.get("/api", (c) => c.json(store.listApis()));

  app.get("/api/:id", (c) => {
    const api = store.getApi(c.req.param("id"));
    if (!api) throw notFound("API");
    return c.json(api);
  });

  app.post("/api", async (c) => {
    const taken = new Set(store.listApis().map((a) => a.id));
    const api = buildRegisteredApi(await readJson(c), taken, Date.now());
    health.ensure(api.id);
    store.addApi(api);
    store.note(c.req.header("x-tether-session"), "api.registered", `Registered ${api.name}`, api.baseUrl, { type: "api", id: api.id });
    return c.json(api, 201);
  });

  app.delete("/api/:id", (c) => {
    const api = store.getApi(c.req.param("id"));
    if (!api) throw notFound("API");
    if (api.origin !== "registered") throw new HttpError(403, "forbidden", `${api.name} is part of the official catalog and cannot be removed`);
    store.removeApi(api.id);
    health.remove(api.id);
    store.note(c.req.header("x-tether-session"), "api.removed", `Removed ${api.name}`, null, { type: "api", id: api.id });
    return c.json({ ok: true });
  });

  app.get("/health", (c) => c.json(health.list(store.listApis().map((a) => a.id))));
  app.get("/incident", (c) => c.json(store.incidents));

  return app;
}
