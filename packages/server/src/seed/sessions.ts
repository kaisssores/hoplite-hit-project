import type { Activity, Api, Env, Exchange, ExchangeRequest, Phase, Session } from "@tether/contract";
import { byteLength, DAY, MINUTE, withQuery } from "../util.ts";
import { OFFICIAL_APIS } from "./catalog.ts";
import { SEED_KEY_IDS } from "./keys.ts";

export const SEED_SESSION_ID = "ses_charge01";

const STATUS_TEXT: Record<number, string> = { 200: "OK", 201: "Created", 403: "Forbidden", 503: "Service Unavailable" };

interface Step {
  apiId: string;
  endpointId: string;
  /** Concrete path, with placeholders already filled in. */
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  keyId: string;
  env: Env;
  /** Milliseconds spent in queue, auth, upstream and transfer. */
  timing: [number, number, number, number];
  outcome: { status: number; body: unknown } | { fail: { code: string; message: string } };
}

const HOPS = ["queue", "auth", "upstream", "transfer"] as const;

function find(apiId: string): Api {
  return OFFICIAL_APIS.find((a) => a.id === apiId)!;
}

function build(sessionId: string, index: number, at: number, step: Step): Exchange {
  const api = find(step.apiId);
  const endpoint = api.endpoints.find((e) => e.id === step.endpointId)!;
  const query = step.query ?? {};
  const request: ExchangeRequest = {
    apiId: api.id,
    endpointId: endpoint.id,
    method: endpoint.method,
    path: step.path,
    query,
    headers: step.body === undefined ? {} : { "content-type": "application/json" },
    body: step.body === undefined ? null : JSON.stringify(step.body, null, 2),
    keyId: step.keyId,
    env: step.env,
  };

  const failed = "fail" in step.outcome;
  const reached = failed ? 3 : 4;
  let cursor = at;
  const phases: Phase[] = HOPS.slice(0, reached).map((hop, i) => {
    const phase = { hop, startedAt: cursor, ms: step.timing[i] };
    cursor += step.timing[i];
    return phase;
  });

  let response: Exchange["response"] = null;
  if (!("fail" in step.outcome)) {
    const text = JSON.stringify(step.outcome.body, null, 2);
    response = {
      status: step.outcome.status,
      statusText: STATUS_TEXT[step.outcome.status] ?? "OK",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-request-id": `req_Ke4Tn8Qw2Zr${index}`,
        "server-timing": `upstream;dur=${step.timing[2]}`,
        "x-tether-adapter": api.adapter,
      },
      body: text,
      size: byteLength(text),
    };
  }

  return {
    id: `exc_seed${index + 1}`,
    sessionId,
    adapter: api.adapter,
    request,
    url: api.baseUrl + withQuery(step.path, query),
    state: failed ? "failed" : "done",
    phases,
    response,
    error: "fail" in step.outcome ? { hop: "upstream", ...step.outcome.fail } : null,
    startedAt: at,
    ms: cursor - at,
  };
}

const chargeBody = { amount: 4200, currency: "eur", customer: "cus_Pq7R2xLm9a", payment_method: "pm_1Mt0Xc2eZvKYlo", description: "Order 20418, annual plan", capture: true };

const STEPS: Step[] = [
  { apiId: "payments", endpointId: "payments.create-charge", path: "/v1/charges", body: chargeBody, keyId: SEED_KEY_IDS.checkout, env: "live", timing: [58, 94, 131, 46], outcome: { status: 201, body: find("payments").endpoints[0]!.response.body } },
  { apiId: "payments", endpointId: "payments.get-charge", path: "/v1/charges/ch_3Nf8Qa2eZvKYlo2C", keyId: SEED_KEY_IDS.checkout, env: "live", timing: [47, 81, 104, 38], outcome: { status: 200, body: find("payments").endpoints[1]!.response.body } },
  { apiId: "payments", endpointId: "payments.list-charges", path: "/v1/charges", query: { limit: "3" }, keyId: SEED_KEY_IDS.checkout, env: "live", timing: [52, 77, 122, 63], outcome: { status: 200, body: find("payments").endpoints[2]!.response.body } },
  {
    apiId: "payments",
    endpointId: "payments.refund-charge",
    path: "/v1/charges/ch_3Nf8Qa2eZvKYlo2C/refund",
    body: { amount: 1500, reason: "requested_by_customer" },
    keyId: SEED_KEY_IDS.checkout,
    env: "live",
    timing: [49, 86, 96, 33],
    outcome: { status: 403, body: { error: { type: "insufficient_scope", message: "Key lacks scope payments:refunds.write", required: "payments:refunds.write" } } },
  },
  {
    apiId: "messaging",
    endpointId: "messaging.send-message",
    path: "/v2/messages",
    body: { channel: "sms", to: "+31612345678", template: "tpl_order_shipped", variables: { order: "20418", eta: "Thursday" } },
    keyId: SEED_KEY_IDS.staging,
    env: "test",
    timing: [61, 102, 1874, 40],
    outcome: { status: 503, body: { error: { type: "upstream_unavailable", message: "The SMS provider did not accept the message. Retry in a few seconds." } } },
  },
  {
    apiId: "messaging",
    endpointId: "messaging.send-batch",
    path: "/v2/messages/batch",
    body: { template: "tpl_order_shipped", recipients: [{ to: "+31612345678", variables: { order: "20418" } }] },
    keyId: SEED_KEY_IDS.staging,
    env: "test",
    timing: [55, 90, 2500, 0],
    outcome: { fail: { code: "upstream_timeout", message: "No response from api.tether.dev after 2500 ms" } },
  },
];

/** One finished session from yesterday, so a fresh client opens onto history instead of an empty page. */
export function buildSession(now: number): { session: Session; exchanges: Exchange[]; activity: Activity[] } {
  const createdAt = now - DAY - 40 * MINUTE;
  const exchanges: Exchange[] = [];
  const activity: Activity[] = [
    { id: "act_seed0", sessionId: SEED_SESSION_ID, at: createdAt, kind: "session.started", title: "Session started", detail: null, ref: null },
  ];

  STEPS.forEach((step, index) => {
    const at = createdAt + (index + 1) * 2 * MINUTE + index * 7_000;
    const exchange = build(SEED_SESSION_ID, index, at, step);
    exchanges.push(exchange);
    activity.push({
      id: `act_seed${index + 1}`,
      sessionId: SEED_SESSION_ID,
      at,
      kind: "exchange",
      title: `${exchange.request.method} ${exchange.request.path}`,
      detail: find(step.apiId).name,
      ref: { type: "exchange", id: exchange.id },
    });
  });

  const last = exchanges[exchanges.length - 1]!;
  const session: Session = {
    id: SEED_SESSION_ID,
    title: "Payments · Create a charge",
    createdAt,
    updatedAt: last.startedAt + (last.ms ?? 0),
    exchanges: exchanges.length,
  };
  return { session, exchanges, activity };
}
