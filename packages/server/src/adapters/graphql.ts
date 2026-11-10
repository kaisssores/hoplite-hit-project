import type { Endpoint } from "@tether/contract";
import { clone, sleep } from "../util.ts";
import { parseJsonObject } from "./example.ts";
import { checkAccess, maintenanceEnd, reply, sampleLatency, timeoutFailure, UPSTREAM_TIMEOUT_MS, type RateState, type Simulator } from "./simulation.ts";
import type { Adapter, AdapterContext } from "./types.ts";

type Decision =
  | { kind: "timeout" }
  | { kind: "reply"; status: number; body: unknown; headers?: Record<string, string>; rate?: RateState; slow?: boolean };

const failure = (message: string, code: string) => ({ data: null, errors: [{ message, extensions: { code } }] });

const operationName = (query: unknown): string | null =>
  typeof query === "string" ? (query.match(/\b(?:query|mutation|subscription)\s+(\w+)/)?.[1] ?? null) : null;

function resolveOperation(ctx: AdapterContext, query: unknown): Endpoint | null {
  if (ctx.endpoint) return ctx.endpoint;
  const name = operationName(query);
  if (!name) return null;
  return ctx.api.endpoints.find((e) => operationName((e.requestBody as { query?: unknown } | undefined)?.query) === name) ?? null;
}

function respondWith(endpoint: Endpoint, variables: unknown): unknown {
  const body = clone(endpoint.response.body) as { data?: Record<string, unknown> };
  const id = (variables as { id?: unknown } | null)?.id;
  if (typeof id === "string" && body.data) {
    for (const value of Object.values(body.data)) {
      if (typeof value === "object" && value !== null && "id" in value) (value as { id: string }).id = id;
    }
  }
  return body;
}

function decide(ctx: AdapterContext, sim: Simulator): Decision {
  const { api, request, key, health } = ctx;

  if (health.status === "maintenance") {
    return { kind: "reply", status: 503, body: failure(`${api.name} is in a maintenance window until ${maintenanceEnd(health.note)} UTC`, "MAINTENANCE"), headers: { "retry-after": "900" } };
  }
  if (health.status === "outage") return { kind: "timeout" };

  let payload: { query?: unknown; variables?: unknown } = {};
  if (request.body?.trim()) {
    const parsed = parseJsonObject(request.body);
    if (!parsed) return { kind: "reply", status: 400, body: failure("Request body is not valid JSON", "BAD_REQUEST") };
    payload = parsed;
  }
  if (typeof payload.query !== "string" || !payload.query.trim()) {
    return { kind: "reply", status: 400, body: failure("Must provide query string.", "BAD_REQUEST") };
  }

  const endpoint = resolveOperation(ctx, payload.query);
  if (!endpoint) {
    const field = payload.query.match(/\{\s*(\w+)/)?.[1] ?? "unknown";
    return { kind: "reply", status: 200, body: { errors: [{ message: `Cannot query field "${field}" on type "Query"`, extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }] } };
  }

  const denied = checkAccess({ ...ctx, endpoint });
  if (denied) {
    return { kind: "reply", status: 200, body: failure(denied.message, denied.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN") };
  }

  const rate = sim.take(api, key);
  if (!rate.allowed) {
    return { kind: "reply", status: 429, body: failure(`Rate limit of ${rate.limit} requests per minute exceeded`, "RATE_LIMITED"), headers: { "retry-after": "30" }, rate };
  }

  if (health.status === "degraded" && sim.degradedHit(api.id)) {
    return { kind: "reply", status: 503, body: failure(`${api.name} could not complete the request. Retry in a few seconds.`, "UPSTREAM_UNAVAILABLE"), headers: { "retry-after": "5" }, rate, slow: true };
  }

  return { kind: "reply", status: 200, body: respondWith(endpoint, payload.variables), rate };
}

export function createGraphqlAdapter(sim: Simulator): Adapter {
  return {
    info: {
      id: "graphql",
      label: "GraphQL edge",
      description: "Answers GraphQL operations from recorded examples on the server. Authentication errors come back as HTTP 200 with an errors array.",
      live: false,
    },
    async send(ctx) {
      const decision = decide(ctx, sim);
      if (decision.kind === "timeout") {
        await sleep(UPSTREAM_TIMEOUT_MS * ctx.speed);
        return timeoutFailure(ctx.api);
      }
      const latency = decision.slow ? Math.round(ctx.health.p95 * ctx.speed) : sampleLatency(ctx);
      await sleep(latency);
      return reply(decision.status, decision.body, { adapter: "graphql", latency, rate: decision.rate, headers: decision.headers });
    },
  };
}
