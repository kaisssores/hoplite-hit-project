import { TIMEOUT_ENDPOINTS } from "../seed/catalog.ts";
import { sleep } from "../util.ts";
import { exampleBody } from "./example.ts";
import { challenge, checkAccess, maintenanceEnd, reply, sampleLatency, timeoutFailure, UPSTREAM_TIMEOUT_MS, type RateState, type Simulator } from "./simulation.ts";
import type { Adapter, AdapterContext } from "./types.ts";

type Decision =
  | { kind: "timeout" }
  | { kind: "reply"; status: number; body: unknown; headers?: Record<string, string>; rate?: RateState; slow?: boolean };

const error = (type: string, message: string, extra: Record<string, unknown> = {}) => ({ error: { type, message, ...extra } });

/** Seconds from now until the next HH:MM UTC named in a maintenance note. */
function secondsUntil(note: string | null, now: number): number {
  const match = note?.match(/(\d{1,2}):(\d{2}) UTC/);
  if (!match) return 900;
  const target = new Date(now);
  target.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);
  if (target.getTime() <= now) target.setUTCDate(target.getUTCDate() + 1);
  return Math.ceil((target.getTime() - now) / 1000);
}

function decide(ctx: AdapterContext, sim: Simulator): Decision {
  const { api, endpoint, request, key, health } = ctx;

  if (health.status === "maintenance") {
    const until = maintenanceEnd(health.note);
    return {
      kind: "reply",
      status: 503,
      body: error("maintenance", `${api.name} is in a maintenance window until ${until} UTC`),
      headers: { "retry-after": String(secondsUntil(health.note, Date.now())) },
    };
  }
  if (health.status === "outage") return { kind: "timeout" };

  if (!endpoint) {
    return { kind: "reply", status: 404, body: error("not_found", `No route matches ${request.method} ${request.path}`) };
  }

  const denied = checkAccess(ctx);
  if (denied) {
    return {
      kind: "reply",
      status: denied.status,
      body: error(denied.type, denied.message, denied.extra),
      headers: denied.status === 401 ? { "www-authenticate": challenge(api) } : undefined,
    };
  }

  const rate = sim.take(api, key);
  if (!rate.allowed) {
    return {
      kind: "reply",
      status: 429,
      body: error("rate_limited", `Rate limit of ${rate.limit} requests per minute exceeded`),
      headers: { "retry-after": String(Math.max(1, rate.reset - Math.floor(Date.now() / 1000))) },
      rate,
    };
  }

  const missing = endpoint.params.find((p) => p.required && p.in === "query" && !request.query[p.name]);
  if (missing) {
    return { kind: "reply", status: 422, body: error("invalid_request", `Missing required parameter: ${missing.name}`, { param: missing.name }), rate };
  }

  if (["POST", "PUT", "PATCH"].includes(request.method) && request.body?.trim()) {
    try {
      JSON.parse(request.body);
    } catch {
      return { kind: "reply", status: 400, body: error("invalid_json", "Request body is not valid JSON"), rate };
    }
  }

  if (TIMEOUT_ENDPOINTS.has(endpoint.id)) return { kind: "timeout" };

  if (health.status === "degraded" && sim.degradedHit(api.id)) {
    return {
      kind: "reply",
      status: 503,
      body: error("upstream_unavailable", `${api.name} could not complete the request. Retry in a few seconds.`),
      headers: { "retry-after": "5" },
      rate,
      slow: true,
    };
  }

  const { status } = endpoint.response;
  return { kind: "reply", status, body: status === 204 ? null : exampleBody(endpoint, request, request.env), rate };
}

export function createRestAdapter(sim: Simulator): Adapter {
  return {
    info: {
      id: "rest",
      label: "REST gateway",
      description: "Answers from recorded examples on the server, applying the same key, scope and parameter rules a real gateway would.",
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
      return reply(decision.status, decision.body, { adapter: "rest", latency, rate: decision.rate, headers: decision.headers });
    },
  };
}
