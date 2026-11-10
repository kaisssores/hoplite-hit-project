import type { Api, Endpoint, ExchangeRequest, Method } from "@tether/contract";
import { Hono } from "hono";
import { matchPath } from "../adapters/example.ts";
import { invalid, isRecord, notFound, requireOneOf, requireString } from "../errors.ts";
import { startExchange } from "../exchange.ts";
import type { Runtime } from "../runtime.ts";
import { readJson } from "./http.ts";

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function stringMap(value: unknown, field: string): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (!isRecord(value) || !Object.values(value).every((v) => typeof v === "string")) throw invalid(`${field} must be an object of strings`);
  return value as Record<string, string>;
}

function parseRequest(body: Record<string, unknown>): ExchangeRequest {
  const route = requireString(body, "path");
  if (!route.startsWith("/")) throw invalid('path must start with "/"');
  if (body.body !== undefined && body.body !== null && typeof body.body !== "string") throw invalid("body must be a string or null");
  for (const field of ["keyId", "endpointId"]) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== "string") throw invalid(`${field} must be a string or null`);
  }
  return {
    apiId: requireString(body, "apiId"),
    endpointId: (body.endpointId as string | null | undefined) ?? null,
    method: requireOneOf(body, "method", METHODS),
    path: route,
    query: stringMap(body.query, "query"),
    headers: stringMap(body.headers, "headers"),
    body: (body.body as string | null | undefined) ?? null,
    keyId: (body.keyId as string | null | undefined) ?? null,
    env: requireOneOf(body, "env", ["live", "test"] as const, "live"),
  };
}

/** Uses the endpoint the client named, or the one documentation uniquely matches. Free-form paths stay `null`. */
function resolveEndpoint(api: Api, request: ExchangeRequest): Endpoint | null {
  if (request.endpointId) return api.endpoints.find((e) => e.id === request.endpointId) ?? null;
  const matches = api.endpoints.filter((e) => e.method === request.method && matchPath(e.path, request.path));
  return matches.length === 1 ? matches[0]! : null;
}

export function sessionRoutes(rt: Runtime): Hono {
  const { store } = rt;
  const app = new Hono();

  const requireSession = (id: string) => {
    const session = store.getSession(id);
    if (!session) throw notFound("Session");
    return session;
  };

  app.get("/session", (c) => c.json(store.listSessions()));

  app.post("/session", async (c) => {
    const body = await readJson(c);
    const title = typeof body.title === "string" ? body.title.slice(0, 120) : undefined;
    return c.json(store.createSession(title), 201);
  });

  app.patch("/session/:id", async (c) => {
    requireSession(c.req.param("id"));
    const title = requireString(await readJson(c), "title", { max: 120 });
    return c.json(store.updateSession(c.req.param("id"), { title }));
  });

  app.delete("/session/:id", (c) => {
    if (!store.removeSession(c.req.param("id"))) throw notFound("Session");
    return c.json({ ok: true });
  });

  app.get("/session/:id/exchange", (c) => {
    requireSession(c.req.param("id"));
    return c.json(store.listExchanges(c.req.param("id")));
  });

  app.get("/session/:id/activity", (c) => {
    requireSession(c.req.param("id"));
    return c.json(store.listActivity(c.req.param("id")));
  });

  app.post("/session/:id/exchange", async (c) => {
    const session = requireSession(c.req.param("id"));
    const request = parseRequest(await readJson(c));
    const api = store.getApi(request.apiId);
    if (!api) throw notFound(`API "${request.apiId}"`);
    const endpoint = resolveEndpoint(api, request);
    return c.json(startExchange(rt, session.id, api, endpoint, { ...request, endpointId: endpoint?.id ?? null }), 202);
  });

  return app;
}
