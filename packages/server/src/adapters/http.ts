import { byteLength, prettyJson, withQuery } from "../util.ts";
import { statusText } from "./simulation.ts";
import type { Adapter, AdapterResult } from "./types.ts";

const TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 256 * 1024;
const BLOCKED_HOSTS = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)|(^|\.)(internal|local)$/;

/** Literal host check only; it does not resolve DNS, so it is a guard rail rather than an SSRF boundary. */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd") || BLOCKED_HOSTS.test(host);
}

async function readCapped(response: Response): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (size < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  if (size >= MAX_BODY_BYTES) {
    truncated = true;
    await reader.cancel();
  }
  const bytes = Buffer.concat(chunks).subarray(0, MAX_BODY_BYTES);
  return { text: bytes.toString("utf8"), truncated };
}

const failure = (code: string, message: string): AdapterResult => ({ ok: false, code, message });

/** Forwards to the API's real base URL. */
export const httpAdapter: Adapter = {
  info: {
    id: "http",
    label: "Live HTTP",
    description: "Forwards the request to the API's base URL over the network and returns what comes back.",
    live: true,
  },
  async send(ctx) {
    const { api, request, key } = ctx;
    const url = new URL(api.baseUrl.replace(/\/$/, "") + withQuery(request.path, request.query));
    if (isBlockedHost(url.hostname)) {
      return failure("blocked_host", `Requests to ${url.hostname} are blocked. Private, loopback and link-local addresses cannot be called.`);
    }

    // The server stores only a hash of each secret, so it can name the key but never replay it.
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");
    if (key) headers.set("x-tether-key-id", key.id);

    try {
      const response = await fetch(url, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "DELETE" ? undefined : (request.body ?? undefined),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "manual",
      });
      const { text, truncated } = await readCapped(response);
      const isJson = (response.headers.get("content-type") ?? "").includes("json");
      const body = isJson ? prettyJson(text) : text;
      const out: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        out[name] = value;
      });
      if (truncated) out["x-tether-truncated"] = "true";
      out["x-tether-adapter"] = "http";
      return { ok: true, response: { status: response.status, statusText: response.statusText || statusText(response.status), headers: out, body, size: byteLength(body) } };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "TimeoutError" || name === "AbortError") return failure("upstream_timeout", `No response from ${url.host} after ${TIMEOUT_MS} ms`);
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : error instanceof Error ? error.message : "Request failed";
      return failure("upstream_unreachable", `Could not reach ${url.host}: ${cause}`);
    }
  },
};
