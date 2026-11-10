import type { Api, AuthScheme, Endpoint, Method, Param } from "@tether/contract";
import { invalid, isRecord, requireOneOf, requireString } from "./errors.ts";
import { isoDate, slugify } from "./util.ts";

const METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const AUTH: AuthScheme[] = ["api_key", "bearer", "hmac", "none"];

function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

function buildEndpoint(apiId: string, raw: unknown, taken: Set<string>): Endpoint {
  if (!isRecord(raw)) throw invalid("Each endpoint must be an object");
  const method = requireOneOf(raw, "method", METHODS);
  const route = requireString(raw, "path");
  if (!route.startsWith("/")) throw invalid(`Endpoint path must start with "/": ${route}`);
  const summary = requireString(raw, "summary", { optional: true, max: 120 }) || `${method} ${route}`;

  const id = uniqueId(`${apiId}.${method.toLowerCase()}-${slugify(route, 40) || "root"}`, taken);
  taken.add(id);
  const params: Param[] = [...route.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1]!,
    in: "path",
    type: "string",
    required: true,
    description: `Value for ${m[1]} in the path`,
  }));

  return {
    id,
    method,
    path: route,
    summary,
    description: summary,
    params,
    scope: null,
    ...(method === "POST" || method === "PUT" || method === "PATCH" ? { requestBody: {} } : {}),
    response: { status: 200, body: { ok: true } },
  };
}

/** Turns the registration form into a catalog entry. `takenIds` holds every API id already in use. */
export function buildRegisteredApi(input: unknown, takenIds: ReadonlySet<string>, now: number): Api {
  if (!isRecord(input)) throw invalid("Body must be an object");
  const name = requireString(input, "name", { max: 60 });
  const baseUrl = requireString(input, "baseUrl");
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw invalid("baseUrl must be a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw invalid("baseUrl must start with http:// or https://");

  const auth = requireOneOf(input, "auth", AUTH, "api_key");
  const upstream = requireOneOf(input, "upstream", ["simulated", "live"] as const, "simulated");
  const rawEndpoints = input.endpoints;
  if (!Array.isArray(rawEndpoints) || rawEndpoints.length === 0) throw invalid("At least one endpoint is required");

  const id = uniqueId(slugify(name) || "api", takenIds);
  const taken = new Set<string>();
  const summary = requireString(input, "summary", { optional: true, max: 200 });

  return {
    id,
    name,
    summary,
    description: summary,
    category: requireString(input, "category", { optional: true, max: 40 }) || "Other",
    owner: "You",
    origin: "registered",
    adapter: upstream === "live" ? "http" : "rest",
    version: "1.0.0",
    stability: "beta",
    baseUrl: baseUrl.replace(/\/+$/, ""),
    auth,
    scopes: [],
    rateLimit: 60,
    endpoints: rawEndpoints.map((e) => buildEndpoint(id, e, taken)),
    changelog: [{ version: "1.0.0", date: isoDate(now), note: "Registered in Tether" }],
    registeredAt: now,
  };
}
