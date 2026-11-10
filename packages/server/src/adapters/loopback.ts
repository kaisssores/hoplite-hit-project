import { byteLength, prettyJson, sleep, withQuery } from "../util.ts";
import { reply, statusText } from "./simulation.ts";
import type { Adapter } from "./types.ts";

const MIN_UPSTREAM_MS = 120;
const STREAM_ROUTE = /^\/v1\/event(\/|$)/;
const EXCHANGE_ROUTE = /^\/v1\/session\/[^/]+\/exchange\/?$/;

/** Calls the server's own routes in process, so Hub requests return real, current data. */
export const loopbackAdapter: Adapter = {
  info: {
    id: "loopback",
    label: "Hub loopback",
    description: "Calls this server's own routes in process. The data you get back is live.",
    live: true,
  },
  async send(ctx) {
    const { request, speed } = ctx;
    const refusal = STREAM_ROUTE.test(request.path)
      ? { code: "stream_not_supported", message: "The event stream never ends, so it cannot be called through the playground" }
      : request.method === "POST" && EXCHANGE_ROUTE.test(request.path)
        ? { code: "recursion_not_supported", message: "Sending an exchange from inside an exchange would call itself forever" }
        : null;
    if (refusal) return reply(400, { error: refusal }, { adapter: "loopback", latency: 0 });

    const started = Date.now();
    const hasBody = request.method !== "GET" && request.body !== null;
    const response = await ctx.self(withQuery(request.path, request.query), {
      method: request.method,
      headers: { ...request.headers, "x-tether-session": ctx.sessionId },
      body: hasBody ? request.body : undefined,
    });
    const text = prettyJson(await response.text());
    const elapsed = Date.now() - started;
    await sleep(MIN_UPSTREAM_MS * speed - elapsed);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      if (!name.startsWith("access-control-")) headers[name] = value;
    });
    headers["server-timing"] = `upstream;dur=${Math.max(elapsed, Math.round(MIN_UPSTREAM_MS * speed))}`;
    headers["x-tether-adapter"] = "loopback";

    return { ok: true, response: { status: response.status, statusText: statusText(response.status), headers, body: text, size: byteLength(text) } };
  },
};
