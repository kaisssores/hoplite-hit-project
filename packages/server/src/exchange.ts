import type { Api, Endpoint, Exchange, ExchangeRequest, Hop, Key } from "@tether/contract";
import type { Runtime } from "./runtime.ts";
import { between, clone, isDefaultSessionTitle, newId, sleep, withQuery } from "./util.ts";

/** Tether's own credential check, before anything is sent upstream. No key is fine here; the upstream decides. */
function checkKey(request: ExchangeRequest, key: Key | undefined): { code: string; message: string } | null {
  if (!request.keyId) return null;
  if (!key) return { code: "key_not_found", message: `Key "${request.keyId}" does not exist` };
  if (key.status === "revoked") return { code: "key_revoked", message: `Key "${key.name}" was revoked and can no longer sign requests` };
  if (key.env !== request.env) return { code: "env_mismatch", message: `Key "${key.name}" is a ${key.env} key but the request targets ${request.env}` };
  return null;
}

/**
 * Creates the exchange, announces it, and walks it through queue, auth, upstream and transfer in the
 * background. Returns the exchange as accepted; every later step arrives as an `exchange.updated` event.
 */
export function startExchange(rt: Runtime, sessionId: string, api: Api, endpoint: Endpoint | null, request: ExchangeRequest): Exchange {
  const { store } = rt;
  const startedAt = Date.now();
  const exchange: Exchange = {
    id: newId("exc", 10),
    sessionId,
    adapter: api.adapter,
    request,
    url: api.baseUrl + withQuery(request.path, request.query),
    state: "running",
    phases: [{ hop: "queue", startedAt, ms: null }],
    response: null,
    error: null,
    startedAt,
    ms: null,
  };
  store.putExchange(exchange);
  store.note(sessionId, "exchange", `${request.method} ${request.path}`, api.name, { type: "exchange", id: exchange.id });

  const session = store.getSession(sessionId)!;
  const firstUnnamed = session.exchanges === 0 && isDefaultSessionTitle(session.title);
  store.updateSession(sessionId, {
    exchanges: session.exchanges + 1,
    ...(firstUnnamed ? { title: `${api.name} · ${endpoint?.summary ?? request.path}` } : {}),
  });

  const accepted = clone(exchange);
  void run(rt, exchange, api, endpoint).catch((error: unknown) => console.error("tether: exchange runner failed", error));
  return accepted;
}

async function run(rt: Runtime, exchange: Exchange, api: Api, endpoint: Endpoint | null): Promise<void> {
  const { store, health, speed } = rt;
  const { request } = exchange;
  let hop: Hop = "queue";
  let key: Key | undefined;
  let authorised = false;
  let reachedUpstream = false;

  const closeOpenPhase = () => {
    const open = exchange.phases[exchange.phases.length - 1]!;
    if (open.ms === null) open.ms = Date.now() - open.startedAt;
  };
  const advance = (next: Hop) => {
    closeOpenPhase();
    hop = next;
    exchange.phases.push({ hop: next, startedAt: Date.now(), ms: null });
    store.putExchange(exchange);
  };
  const fail = (code: string, message: string) => {
    closeOpenPhase();
    exchange.state = "failed";
    exchange.error = { hop, code, message };
    exchange.ms = Date.now() - exchange.startedAt;
    store.putExchange(exchange);
  };

  try {
    await sleep(between(40, 90) * speed);
    advance("auth");

    await sleep(between(60, 140) * speed);
    key = request.keyId ? store.getKey(request.keyId) : undefined;
    const problem = checkKey(request, key);
    if (problem) {
      fail(problem.code, problem.message);
      return;
    }
    authorised = key !== undefined;
    advance("upstream");
    reachedUpstream = true;

    const result = await rt.adapters[api.adapter].send({
      api,
      endpoint,
      request,
      key: key ?? null,
      health: clone(health.ensure(api.id)),
      speed,
      sessionId: exchange.sessionId,
      self: rt.self,
    });
    if (!result.ok) {
      fail(result.code, result.message);
      return;
    }

    advance("transfer");
    await sleep((between(30, 80) + result.response.size / 2048) * speed);
    closeOpenPhase();
    exchange.state = "done";
    exchange.response = result.response;
    exchange.ms = Date.now() - exchange.startedAt;
    store.putExchange(exchange);
  } catch (error) {
    fail("internal_error", error instanceof Error ? error.message : "The request could not be completed");
  } finally {
    const status = exchange.response?.status ?? 0;
    if (authorised && key) store.touchKey(key.id);
    store.recordUsage(api.id, authorised && key ? key.id : null, exchange.state === "failed" || status >= 400);
    if (reachedUpstream) health.record(api.id, exchange.state === "failed" || status >= 500);
  }
}
