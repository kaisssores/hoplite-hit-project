import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { DEFAULT_LAYOUT, HOPS, type Account, type Api, type Exchange, type Key, type KeySecret, type Preferences, type Session } from "@tether/contract";
import { harness } from "./helpers.ts";

type Harness = Awaited<ReturnType<typeof harness>>;

describe("tether server", () => {
  let h: Harness;
  let session: Session;

  before(async () => {
    h = await harness();
    session = (await h.call<Session>("POST", "/v1/session", {})).body;
  });
  after(() => h.close());

  it("lists the catalog with official APIs first and the hub after them", async () => {
    const { status, body } = await h.call<Api[]>("GET", "/v1/api");
    assert.equal(status, 200);
    assert.deepEqual(body.slice(0, 3).map((a) => a.id), ["identity", "payments", "ledger"]);
    assert.equal(body.length, 11);
    assert.equal(body[10]!.id, "hub");
    assert.equal(body[10]!.adapter, "loopback");
    assert.equal((await h.call("GET", "/v1/api/nope")).status, 404);
  });

  it("returns a key secret once and never lists it", async () => {
    const created = await h.call<KeySecret>("POST", "/v1/key", { name: "CI", env: "test", apiIds: ["payments"], scopes: ["payments:charges.read"] });
    assert.equal(created.status, 201);
    assert.match(created.body.secret, /^tth_test_[0-9A-Za-z]{24}$/);
    assert.equal(created.body.key.prefix, created.body.secret.slice(0, 13));
    assert.equal(created.body.key.last4, created.body.secret.slice(-4));

    const list = await h.call<Key[]>("GET", "/v1/key");
    assert.equal(list.body[0]!.id, created.body.key.id);
    assert.ok(!JSON.stringify(list.body).includes(created.body.secret));

    await h.rt.store.flush();
    const file = await readFile(h.dataPath, "utf8");
    assert.ok(!file.includes(created.body.secret));
    assert.ok(file.includes("secretHash"));

    const bad = await h.call("POST", "/v1/key", { name: "x", env: "live", apiIds: ["payments"], scopes: ["payments:nope"] });
    assert.equal(bad.status, 422);
  });

  it("walks an exchange through four hops and returns a response", async () => {
    const exchange = await h.exchange(session.id, {
      apiId: "payments",
      method: "POST",
      path: "/v1/charges",
      body: JSON.stringify({ amount: 900, currency: "eur" }),
      keyId: "key_checkout",
    });
    assert.equal(exchange.state, "done");
    assert.deepEqual(exchange.phases.map((p) => p.hop), HOPS);
    assert.ok(exchange.phases.every((p) => p.ms !== null));
    assert.equal(exchange.response?.status, 201);
    const body = JSON.parse(exchange.response!.body) as { id: string; amount: number };
    assert.match(body.id, /^ch_/);
    assert.equal(body.amount, 900);
    assert.equal(exchange.request.endpointId, "payments.create-charge");

    const updated = (await h.call<Session[]>("GET", "/v1/session")).body.find((s) => s.id === session.id)!;
    assert.equal(updated.exchanges, 1);
    assert.equal(updated.title, "Payments · Create a charge");
  });

  it("lets the upstream refuse a request that has no key", async () => {
    const exchange = await h.exchange(session.id, { apiId: "payments", method: "GET", path: "/v1/charges" });
    assert.equal(exchange.state, "done");
    assert.equal(exchange.response?.status, 401);
    assert.equal(exchange.response?.headers["www-authenticate"], 'ApiKey realm="payments"');
  });

  it("fails at the auth hop for a revoked key", async () => {
    const exchange = await h.exchange(session.id, { apiId: "identity", method: "GET", path: "/users", keyId: "key_mobile" });
    assert.equal(exchange.state, "failed");
    assert.equal(exchange.error?.hop, "auth");
    assert.equal(exchange.error?.code, "key_revoked");
    assert.match(exchange.error!.message, /Old mobile app/);
  });

  it("fails at the upstream hop when an endpoint never answers", async () => {
    const exchange = await h.exchange(session.id, {
      apiId: "messaging",
      method: "POST",
      path: "/v2/messages/batch",
      body: "{}",
      keyId: "key_staging",
      env: "test",
    });
    assert.equal(exchange.state, "failed");
    assert.equal(exchange.error?.hop, "upstream");
    assert.equal(exchange.error?.code, "upstream_timeout");
  });

  it("reports GraphQL authentication problems as HTTP 200 with an errors array", async () => {
    const exchange = await h.exchange(session.id, {
      apiId: "storefront",
      method: "POST",
      path: "/graphql",
      body: JSON.stringify({ query: "query ProductById($id: ID!) { product(id: $id) { id } }", variables: { id: "prd_1" } }),
    });
    assert.equal(exchange.response?.status, 200);
    const body = JSON.parse(exchange.response!.body) as { errors: { extensions: { code: string } }[] };
    assert.equal(body.errors[0]!.extensions.code, "UNAUTHENTICATED");
  });

  it("answers Hub requests through the loopback adapter with real data", async () => {
    const exchange = await h.exchange(session.id, { apiId: "hub", endpointId: "hub.get-api", method: "GET", path: "/v1/api" });
    assert.equal(exchange.adapter, "loopback");
    assert.equal(exchange.state, "done");
    const apis = JSON.parse(exchange.response!.body) as Api[];
    assert.equal(apis.length, 11);

    const stream = await h.exchange(session.id, { apiId: "hub", method: "GET", path: "/v1/event" });
    assert.equal(stream.response?.status, 400);
  });

  it("merges preferences by layout field and clamps sizes", async () => {
    const put = await h.call<Preferences>("PUT", "/v1/preferences", { theme: "chart-room", layout: { dock: "bottom", dockSize: 9999, benchRatio: 0.1 } });
    assert.equal(put.status, 200);
    assert.equal(put.body.theme, "chart-room");
    assert.equal(put.body.layout.dock, "bottom");
    assert.equal(put.body.layout.dockSize, 520);
    assert.equal(put.body.layout.benchRatio, 0.25);
    assert.equal(put.body.layout.nav, "left");
    assert.deepEqual(put.body.layout.catalog, DEFAULT_LAYOUT.catalog);

    assert.equal((await h.call("PUT", "/v1/preferences", { theme: "neon" })).status, 422);
  });

  it("registers, updates and forgets the account", async () => {
    assert.equal((await h.call("GET", "/v1/account")).body, null);
    assert.equal((await h.call("PUT", "/v1/account", { name: "Mara", email: "not-an-email" })).status, 422);

    const created = await h.call<Account>("PUT", "/v1/account", { name: " Mara Lindqvist ", email: "mara@northwind.dev", team: "Payments" });
    assert.equal(created.status, 200);
    assert.equal(created.body.name, "Mara Lindqvist");

    const updated = await h.call<Account>("PUT", "/v1/account", { name: "Mara L.", email: "mara@northwind.dev" });
    assert.equal(updated.body.team, "");
    assert.equal(updated.body.createdAt, created.body.createdAt);

    assert.equal((await h.call("DELETE", "/v1/account")).status, 200);
    assert.equal((await h.call("GET", "/v1/account")).body, null);
  });

  it("registers and removes an API, and keeps official ones", async () => {
    const created = await h.call<Api>(
      "POST",
      "/v1/api",
      { name: "Inventory", summary: "Stock levels", category: "Commerce", baseUrl: "https://inventory.example.com/", auth: "api_key", upstream: "simulated", endpoints: [{ method: "GET", path: "/stock/{sku}", summary: "Stock for a SKU" }] },
      { "x-tether-session": session.id },
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.id, "inventory");
    assert.equal(created.body.endpoints[0]!.params[0]!.name, "sku");

    const activity = await h.call<{ kind: string }[]>("GET", `/v1/session/${session.id}/activity`);
    assert.ok(activity.body.some((a) => a.kind === "api.registered"));

    assert.equal((await h.call("DELETE", "/v1/api/inventory")).status, 200);
    const refused = await h.call<{ error: { code: string } }>("DELETE", "/v1/api/payments");
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error.code, "forbidden");
  });

  it("restores sessions and keys after a restart", async () => {
    await h.rt.store.flush();
    const again = await harness(h.dir);
    const sessions = (await again.call<Session[]>("GET", "/v1/session")).body;
    assert.ok(sessions.some((s) => s.id === session.id));
    const exchanges = (await again.call<Exchange[]>("GET", `/v1/session/${session.id}/exchange`)).body;
    assert.ok(exchanges.length >= 5);
    await again.rt.close();
  });
});
