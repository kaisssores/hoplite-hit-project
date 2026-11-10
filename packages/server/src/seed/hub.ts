import { ROUTES, TETHER_VERSION, type Api, type Endpoint, type Param } from "@tether/contract";
import { endpoint, path, query } from "./dsl.ts";

/** Routes that cannot be called through the hub adapter: a stream never ends, and an exchange would recurse. */
const EXCLUDED = new Set(["GET /v1/event", "POST /v1/session/{id}/exchange"]);

const sessionExample = { id: "ses_charge01", title: "Payments · Create a charge", createdAt: 1794182400000, updatedAt: 1794186000000, exchanges: 6 };
const keyExample = { id: "key_checkout", name: "Checkout service", env: "live", prefix: "tth_live_8f3k", last4: "q2Zx", status: "active", requests: 184212 };

const EXAMPLES: Record<string, { body?: unknown; status?: number; response: unknown }> = {
  "GET /v1/server": { response: { version: TETHER_VERSION, startedAt: 1794268800000, dataPath: ".tether/state.json", adapters: [{ id: "rest", label: "REST gateway", live: false }] } },
  "GET /v1/doc": { response: [{ method: "GET", path: "/v1/server", summary: "Server version, start time and adapters", returns: "ServerInfo" }] },
  "GET /v1/api": { response: [{ id: "payments", name: "Payments", version: "2026-09-01", stability: "stable" }] },
  "GET /v1/api/{id}": { response: { id: "payments", name: "Payments", version: "2026-09-01", endpoints: [{ id: "payments.create-charge", method: "POST", path: "/v1/charges" }] } },
  "POST /v1/api": {
    body: { name: "Inventory", summary: "Stock levels by warehouse", category: "Commerce", baseUrl: "https://inventory.example.com", auth: "api_key", upstream: "simulated", endpoints: [{ method: "GET", path: "/stock/{sku}", summary: "Stock for a SKU" }] },
    status: 201,
    response: { id: "inventory", name: "Inventory", origin: "registered", adapter: "rest", version: "1.0.0" },
  },
  "DELETE /v1/api/{id}": { response: { ok: true } },
  "GET /v1/health": { response: [{ apiId: "payments", status: "operational", p50: 118, p95: 310, errorRate: 0.0021, uptime: 99.994 }] },
  "GET /v1/incident": { response: [{ id: "inc_messaging_sms", apiId: "messaging", title: "Elevated SMS delivery latency", status: "identified" }] },
  "GET /v1/key": { response: [keyExample] },
  "POST /v1/key": {
    body: { name: "Reporting job", env: "test", apiIds: ["payments"], scopes: ["payments:charges.read"] },
    status: 201,
    response: { key: { ...keyExample, id: "key_9d3k2m1a", name: "Reporting job", env: "test", prefix: "tth_test_Zk3m" }, secret: "tth_test_Zk3mQ8vX1nR5cT7yL2wB9hDa" },
  },
  "POST /v1/key/{id}/rotate": { response: { key: keyExample, secret: "tth_live_8f3kPq2LmXc4TnZ7aRb9sWd1" } },
  "POST /v1/key/{id}/revoke": { response: { ...keyExample, status: "revoked" } },
  "GET /v1/session": { response: [sessionExample] },
  "POST /v1/session": { body: { title: "Refund flow" }, status: 201, response: { ...sessionExample, title: "Refund flow", exchanges: 0 } },
  "PATCH /v1/session/{id}": { body: { title: "Refund flow, take two" }, response: { ...sessionExample, title: "Refund flow, take two" } },
  "DELETE /v1/session/{id}": { response: { ok: true } },
  "GET /v1/session/{id}/exchange": { response: [{ id: "exc_2k8d1f0a", state: "done", request: { method: "POST", path: "/v1/charges" }, response: { status: 201 } }] },
  "GET /v1/session/{id}/activity": { response: [{ id: "act_7q1m4c2z", kind: "exchange", title: "POST /v1/charges", detail: "Payments" }] },
  "GET /v1/usage": { response: { range: "24h", totals: { requests: 214806, errors: 903, p50: 96, previousRequests: 201344 } } },
  "GET /v1/preferences": { response: { theme: "haze", motion: "system", layout: { nav: "left", dock: "right" }, saved: [] } },
  "PUT /v1/preferences": { body: { theme: "haze-night", layout: { dock: "bottom" } }, response: { theme: "haze-night", motion: "system", layout: { nav: "left", dock: "bottom" }, saved: [] } },
  "GET /v1/account": { response: { name: "Mara Lindqvist", email: "mara@northwind.dev", team: "Payments platform", createdAt: 1794268800000 } },
  "PUT /v1/account": { body: { name: "Mara Lindqvist", email: "mara@northwind.dev", team: "Payments platform" }, response: { name: "Mara Lindqvist", email: "mara@northwind.dev", team: "Payments platform", createdAt: 1794268800000 } },
};

const ID_PARAM: Param = path("id", "Id of the resource named in the path", "ses_charge01");

function summaryFor(method: string, route: string): string {
  return ROUTES.find((r) => r.method === method && r.path === route)?.summary ?? `${method} ${route}`;
}

function endpointId(method: string, route: string): string {
  const slug = route.replace(/^\/v1\//, "").replace(/\{id\}/g, "by-id").replace(/\//g, "-");
  return `hub.${method.toLowerCase()}-${slug}`;
}

/** The server describes itself with the same catalog shape it uses for everyone else's APIs. */
export function buildHub(port: number): Api {
  const endpoints: Endpoint[] = ROUTES.filter((r) => !EXCLUDED.has(`${r.method} ${r.path}`)).map((route) => {
    const example = EXAMPLES[`${route.method} ${route.path}`] ?? { response: { ok: true } };
    const params: Param[] = route.path.includes("{id}") ? [ID_PARAM] : [];
    if (route.method === "GET" && route.path === "/v1/usage") {
      params.push(query("range", "string", "Window to aggregate: 24h, 7d or 30d", { example: "7d" }));
    }
    return endpoint(endpointId(route.method, route.path), route.method, route.path, summaryFor(route.method, route.path), {
      description: `${route.summary}. Returns ${route.returns}.`,
      params,
      scope: null,
      body: example.body,
      status: example.status,
      response: example.response,
    });
  });

  return {
    id: "hub",
    name: "Tether Hub",
    summary: "The Tether server's own API, called in process",
    description:
      "Everything the web client does goes through this API: catalog, keys, sessions, preferences and the live event stream. Requests sent from the playground run against this server for real, so the data you see is current. The event stream and the exchange route are left out because they cannot be called through the playground.",
    category: "Platform",
    owner: "Tether",
    origin: "hub",
    adapter: "loopback",
    version: TETHER_VERSION,
    stability: "stable",
    baseUrl: `http://127.0.0.1:${port}`,
    auth: "none",
    scopes: [],
    rateLimit: 600,
    endpoints,
    changelog: [
      { version: TETHER_VERSION, date: "2026-11-03", note: "First public cut of the server API: catalog, keys, sessions, usage and preferences" },
      { version: "0.0.9", date: "2026-10-20", note: "Event stream carries every state change as one JSON object per message" },
    ],
    registeredAt: Date.parse("2026-10-01T08:00:00Z"),
  };
}
