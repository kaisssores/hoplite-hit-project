import type { Api, Endpoint, Env, ExchangeRequest, Key } from "@tether/sdk";
import type { Draft, Row } from "./store";

export function endpointOf(api: Api | undefined, id: string | null): Endpoint | null {
  return api?.endpoints.find((endpoint) => endpoint.id === id) ?? null;
}

export type Coverage = "ok" | "revoked" | "env" | "no-api" | "no-scope";

/** Whether a key can make this call, and if not, the first reason why. */
export function coverage(key: Key, api: Api, endpoint: Endpoint | null, env: Env): Coverage {
  if (key.status === "revoked") return "revoked";
  if (key.env !== env) return "env";
  if (!key.apiIds.includes(api.id)) return "no-api";
  if (endpoint?.scope && !key.scopes.includes(`${api.id}:${endpoint.scope}`)) return "no-scope";
  return "ok";
}

export const COVERAGE_NOTE: Record<Coverage, string> = {
  ok: "Covers this call",
  revoked: "Revoked",
  env: "Other environment",
  "no-api": "Not enabled for this API",
  "no-scope": "Missing the scope",
};

export function pickKey(api: Api, endpoint: Endpoint | null, keys: Key[], env: Env): string | null {
  if (api.auth === "none") return null;
  const usable = keys.filter((key) => key.status === "active" && key.env === env);
  const best =
    usable.find((key) => coverage(key, api, endpoint, env) === "ok") ??
    usable.find((key) => key.apiIds.includes(api.id));
  return best?.id ?? null;
}

export function draftFor(api: Api, endpoint: Endpoint | null, keys: Key[], previous?: Draft | null): Draft {
  // Stay in the current environment when a key there covers the call. Otherwise a key
  // that covers it in the other environment beats one that will be refused in this one.
  let env: Env = previous?.env ?? "live";
  const other: Env = env === "live" ? "test" : "live";
  const covers = (key: Key | undefined, where: Env) => !!key && coverage(key, api, endpoint, where) === "ok";
  const here = keys.find((key) => key.id === pickKey(api, endpoint, keys, env));
  const there = keys.find((key) => key.id === pickKey(api, endpoint, keys, other));
  let keyId = here?.id ?? null;
  if (api.auth !== "none" && !covers(here, env) && (covers(there, other) || (!here && there))) {
    env = other;
    keyId = there!.id;
  }
  const params = endpoint?.params ?? [];
  const rows = (where: "query" | "header"): Row[] =>
    params
      .filter((param) => param.in === where)
      .map((param) => ({ k: param.name, v: param.example ?? "", on: param.required }));
  return {
    apiId: api.id,
    endpointId: endpoint?.id ?? null,
    method: endpoint?.method ?? "GET",
    path: endpoint?.path ?? "/",
    pathParams: Object.fromEntries(
      params.filter((param) => param.in === "path").map((param) => [param.name, param.example ?? ""]),
    ),
    query: rows("query"),
    headers: rows("header"),
    body: endpoint?.requestBody === undefined ? "" : JSON.stringify(endpoint.requestBody, null, 2),
    keyId,
    env,
  };
}

export function resolvePath(draft: Draft): string {
  return draft.path.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = draft.pathParams[name];
    return value ? encodeURIComponent(value) : whole;
  });
}

function active(rows: Row[]): Record<string, string> {
  return Object.fromEntries(rows.filter((row) => row.on && row.k.trim()).map((row) => [row.k.trim(), row.v]));
}

export function hasBody(draft: Draft): boolean {
  return draft.method !== "GET" && draft.method !== "DELETE";
}

export function buildRequest(draft: Draft): ExchangeRequest {
  const headers = active(draft.headers);
  const body = hasBody(draft) && draft.body.trim() ? draft.body : null;
  if (body && !Object.keys(headers).some((name) => name.toLowerCase() === "content-type")) {
    headers["Content-Type"] = "application/json";
  }
  return {
    apiId: draft.apiId,
    endpointId: draft.endpointId,
    method: draft.method,
    path: resolvePath(draft),
    query: active(draft.query),
    headers,
    body,
    keyId: draft.keyId,
    env: draft.env,
  };
}

export function queryString(draft: Draft): string {
  const query = new URLSearchParams(active(draft.query)).toString();
  return query ? `?${query}` : "";
}

export function bodyProblem(draft: Draft): string | null {
  if (!hasBody(draft) || !draft.body.trim()) return null;
  try {
    JSON.parse(draft.body);
    return null;
  } catch (error) {
    return (error as Error).message.replace(/^JSON\.parse: /, "");
  }
}

/** The credential header an adapter adds for a key. Shown, never sent by the client. */
export function authHeader(api: Api, key: Key | null, placeholder = false): { name: string; value: string } | null {
  if (api.auth === "none") return null;
  const token = placeholder ? "$TETHER_KEY" : key ? `${key.prefix}••••${key.last4}` : "—";
  if (api.auth === "api_key") return { name: "X-Api-Key", value: token };
  if (api.auth === "bearer") return { name: "Authorization", value: `Bearer ${token}` };
  return { name: "X-Tether-Signature", value: placeholder ? "t=$TS,v1=$SIGNATURE" : "t=…,v1=hmac-sha256(secret, t.body)" };
}

export type SnippetLang = "curl" | "javascript" | "python";
export const SNIPPET_LANGS: { id: SnippetLang; label: string }[] = [
  { id: "curl", label: "curl" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
];

export function snippet(lang: SnippetLang, api: Api, draft: Draft): string {
  const request = buildRequest(draft);
  const url = api.baseUrl + request.path + queryString(draft);
  const auth = authHeader(api, null, true);
  const headers: [string, string][] = [...(auth ? [[auth.name, auth.value] as [string, string]] : []), ...Object.entries(request.headers)];
  const body = request.body;

  if (lang === "curl") {
    const lines = [`curl -X ${request.method} "${url}"`];
    for (const [name, value] of headers) lines.push(`  -H "${name}: ${value}"`);
    if (body) lines.push(`  -d '${compactJson(body)}'`);
    return lines.join(" \\\n");
  }

  if (lang === "javascript") {
    const head = headers
      .map(([name, value]) => `    "${name}": ${value.includes("$TETHER_KEY") ? "`" + value.replace("$TETHER_KEY", "${process.env.TETHER_KEY}") + "`" : JSON.stringify(value)},`)
      .join("\n");
    return [
      `const response = await fetch("${url}", {`,
      `  method: "${request.method}",`,
      headers.length ? `  headers: {\n${head}\n  },` : null,
      body ? `  body: JSON.stringify(${indent(prettyJson(body), 2).trimStart()}),` : null,
      `});`,
      ``,
      `const data = await response.json();`,
    ]
      .filter((line) => line !== null)
      .join("\n");
  }

  const head = headers
    .map(([name, value]) => `    "${name}": ${value.includes("$TETHER_KEY") ? `f"${value.replace("$TETHER_KEY", "{os.environ['TETHER_KEY']}")}"` : JSON.stringify(value)},`)
    .join("\n");
  return [
    `import os`,
    `import requests`,
    ``,
    `response = requests.${request.method.toLowerCase()}(`,
    `    "${url}",`,
    headers.length ? `    headers={\n    ${head.replace(/\n/g, "\n    ")}\n    },` : null,
    body ? `    json=${indent(prettyJson(body), 4).trimStart()},` : null,
    `)`,
    ``,
    `data = response.json()`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function compactJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => pad + line)
    .join("\n");
}
