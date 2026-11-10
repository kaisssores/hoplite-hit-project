import type { Key, KeySecret } from "@tether/contract";
import { Hono } from "hono";
import { HttpError, invalid, notFound, requireOneOf, requireString } from "../errors.ts";
import { issueKey, rotateKey } from "../keys.ts";
import type { Runtime } from "../runtime.ts";
import type { Store } from "../store.ts";
import { readJson } from "./http.ts";

const describe = (key: Key) => `${key.env} · ${key.prefix}…${key.last4}`;

function requireStrings(value: unknown, field: string, hint: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw invalid(`${field} must be ${hint}`);
  return value;
}

/** A scope is `apiId:scope`, and the scope must be one the API defines. */
function assertScopeExists(store: Store, scope: string): void {
  const split = scope.indexOf(":");
  const api = split > 0 ? store.getApi(scope.slice(0, split)) : undefined;
  if (!api?.scopes.some((s) => s.name === scope.slice(split + 1))) throw invalid(`Unknown scope: ${scope}`);
}

export function keyRoutes(rt: Runtime): Hono {
  const { store } = rt;
  const app = new Hono();

  app.get("/key", (c) => c.json(store.listKeys()));

  app.post("/key", async (c) => {
    const body = await readJson(c);
    const name = requireString(body, "name", { max: 60 });
    const env = requireOneOf(body, "env", ["live", "test"] as const);
    const apiIds = requireStrings(body.apiIds, "apiIds", "a list of API ids");
    const scopes = requireStrings(body.scopes ?? [], "scopes", "a list of apiId:scope names");
    for (const id of apiIds) if (!store.getApi(id)) throw invalid(`Unknown API: ${id}`);
    for (const scope of scopes) assertScopeExists(store, scope);

    const { stored, secret } = issueKey({ name, env, apiIds, scopes }, Date.now());
    const key = store.putKey(stored);
    store.note(c.req.header("x-tether-session"), "key.created", `Created key "${key.name}"`, describe(key), { type: "key", id: key.id });
    return c.json({ key, secret } satisfies KeySecret, 201);
  });

  app.post("/key/:id/rotate", (c) => {
    const current = store.getStoredKey(c.req.param("id"));
    if (!current) throw notFound("Key");
    if (current.key.status === "revoked") throw new HttpError(409, "key_revoked", `Key "${current.key.name}" is revoked and cannot be rotated`);
    const { stored, secret } = rotateKey(current, Date.now());
    const key = store.putKey(stored);
    store.note(c.req.header("x-tether-session"), "key.rotated", `Rotated key "${key.name}"`, describe(key), { type: "key", id: key.id });
    return c.json({ key, secret } satisfies KeySecret);
  });

  app.post("/key/:id/revoke", (c) => {
    const current = store.getStoredKey(c.req.param("id"));
    if (!current) throw notFound("Key");
    if (current.key.status === "revoked") return c.json(current.key);
    const key = store.putKey({ ...current, key: { ...current.key, status: "revoked" } });
    store.note(c.req.header("x-tether-session"), "key.revoked", `Revoked key "${key.name}"`, describe(key), { type: "key", id: key.id });
    return c.json(key);
  });

  return app;
}
