import type { AdapterId, Api, Key } from "@tether/contract";
import { byteLength, MINUTE, randomString } from "../util.ts";
import type { AdapterContext, AdapterResult } from "./types.ts";

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export const statusText = (status: number) => STATUS_TEXT[status] ?? "OK";

export const UPSTREAM_TIMEOUT_MS = 2500;

export interface RateState {
  limit: number;
  remaining: number;
  /** Unix seconds when the window refills. */
  reset: number;
}

/** Per-process counters shared by the simulated adapters. */
export class Simulator {
  private windows = new Map<string, { resetAt: number; used: number }>();
  private degradedCalls = new Map<string, number>();

  /** Spends one request from a key's per-minute budget for an API. */
  take(api: Api, key: Key | null, now = Date.now()): RateState & { allowed: boolean } {
    const id = `${key?.id ?? "anonymous"}|${api.id}`;
    let window = this.windows.get(id);
    if (!window || window.resetAt <= now) {
      window = { resetAt: now + MINUTE, used: 0 };
      this.windows.set(id, window);
    }
    window.used += 1;
    return {
      allowed: window.used <= api.rateLimit,
      limit: api.rateLimit,
      remaining: Math.max(0, api.rateLimit - window.used),
      reset: Math.ceil(window.resetAt / 1000),
    };
  }

  /** A degraded API fails every third request. */
  degradedHit(apiId: string): boolean {
    const calls = (this.degradedCalls.get(apiId) ?? 0) + 1;
    this.degradedCalls.set(apiId, calls);
    return calls % 3 === 0;
  }
}

/** Latency centred on the API's p50, with an occasional pull toward p95. */
export function sampleLatency(ctx: AdapterContext): number {
  const { p50, p95 } = ctx.health;
  const slow = Math.random() < 0.08;
  const ms = slow ? p95 * (0.85 + Math.random() * 0.2) : p50 * (0.75 + Math.random() * 0.5);
  return Math.round(ms * ctx.speed);
}

export function requestId(): string {
  return `req_${randomString(12)}`;
}

export function maintenanceEnd(note: string | null): string {
  return note?.match(/(\d{1,2}:\d{2}) UTC/)?.[1] ?? "the end of the window";
}

export type Denial = { status: 401 | 403; type: string; message: string; extra?: Record<string, string> };

/** The key rules every simulated API shares: credentials present, key enabled for the API, scope held. */
export function checkAccess(ctx: AdapterContext): Denial | null {
  const { api, endpoint, key } = ctx;
  if (api.auth === "none") return null;
  if (!key) return { status: 401, type: "unauthenticated", message: "Missing credentials. Send an API key in the Authorization header." };
  if (!key.apiIds.includes(api.id)) return { status: 403, type: "forbidden", message: `This key is not enabled for the ${api.name} API` };
  if (endpoint?.scope) {
    const required = `${api.id}:${endpoint.scope}`;
    if (!key.scopes.includes(required)) {
      return { status: 403, type: "insufficient_scope", message: `Key lacks scope ${required}`, extra: { required } };
    }
  }
  return null;
}

const CHALLENGE: Record<string, string> = { bearer: "Bearer", api_key: "ApiKey", hmac: "HMAC-SHA256" };

export const challenge = (api: Api) => `${CHALLENGE[api.auth] ?? "Bearer"} realm="${api.id}"`;

export interface ReplyOptions {
  adapter: AdapterId;
  /** Milliseconds reported in `server-timing`. */
  latency: number;
  rate?: RateState;
  headers?: Record<string, string>;
}

/** Builds a response with the headers a real gateway would add. A `null` body means no content. */
export function reply(status: number, body: unknown, options: ReplyOptions): AdapterResult {
  const text = body === null || status === 204 ? "" : JSON.stringify(body, null, 2);
  const headers: Record<string, string> = {
    ...(text ? { "content-type": "application/json; charset=utf-8" } : {}),
    "x-request-id": requestId(),
    ...(options.rate
      ? {
          "x-ratelimit-limit": String(options.rate.limit),
          "x-ratelimit-remaining": String(options.rate.remaining),
          "x-ratelimit-reset": String(options.rate.reset),
        }
      : {}),
    "server-timing": `upstream;dur=${options.latency}`,
    "x-tether-adapter": options.adapter,
    ...options.headers,
  };
  return { ok: true, response: { status, statusText: statusText(status), headers, body: text, size: byteLength(text) } };
}

export const timeoutFailure = (api: Api): AdapterResult => ({
  ok: false,
  code: "upstream_timeout",
  message: `No response from ${new URL(api.baseUrl).host} after ${UPSTREAM_TIMEOUT_MS} ms`,
});
