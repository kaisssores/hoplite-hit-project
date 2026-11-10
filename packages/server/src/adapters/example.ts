import type { Endpoint, Env, ExchangeRequest } from "@tether/contract";
import { clone, randomString } from "../util.ts";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

export function parseJsonObject(text: string | null): Json | null {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Values of the `{param}` placeholders when a concrete path fits an endpoint template, otherwise `null`. */
export function matchPath(template: string, actual: string): Record<string, string> | null {
  const names: string[] = [];
  const pattern = template
    .split(/(\{\w+\})/)
    .map((part) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1];
      if (!name) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      names.push(name);
      return "([^/]+)";
    })
    .join("");
  const match = actual.match(new RegExp(`^${pattern}$`));
  if (!match) return null;
  return Object.fromEntries(names.map((name, i) => [name, safeDecode(match[i + 1]!)]));
}

const prefixOf = (id: string) => id.match(/^([a-z]+_)/)?.[1] ?? null;

/** Turns a documented example response into one that reflects the request that was sent. */
export function exampleBody(endpoint: Endpoint, request: ExchangeRequest, env: Env, now = Date.now()): unknown {
  const body = clone(endpoint.response.body);
  if (!isObject(body)) return body;

  const writes = request.method !== "GET" && request.method !== "DELETE";
  const sent = writes ? parseJsonObject(request.body) : null;

  if (sent) {
    for (const key of Object.keys(body)) {
      if (key in sent && !["id", "object", "status", "created"].includes(key)) body[key] = sent[key];
    }
  }

  if (writes) {
    for (const key of ["created", "created_at", "updated_at"]) {
      const current = body[key];
      if (typeof current === "number") body[key] = current > 1e12 ? now : Math.floor(now / 1000);
      else if (typeof current === "string") body[key] = new Date(now).toISOString();
    }
  }

  const id = body.id;
  if (typeof id === "string") {
    const creating = request.method === "POST" && (endpoint.response.status === 201 || endpoint.response.status === 202);
    const prefix = prefixOf(id);
    if (creating && prefix) {
      body.id = prefix + randomString(Math.min(Math.max(id.length - prefix.length, 8), 20));
    } else {
      const names = [...endpoint.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
      const last = names[names.length - 1];
      const value = last && /id$/i.test(last) ? matchPath(endpoint.path, request.path)?.[last] : undefined;
      if (value && prefixOf(value) === prefix) body.id = value;
    }
  }

  const limit = Number(request.query.limit);
  if (Array.isArray(body.data) && Number.isInteger(limit) && limit > 0) body.data = body.data.slice(0, limit);

  if ("livemode" in body) body.livemode = env === "live";
  return body;
}
