import { endpoint, official, path, query } from "../dsl.ts";

const hook = {
  id: "whe_3Pk9XvNs",
  url: "https://hooks.northwind.example/tether",
  events: ["charge.succeeded", "charge.refunded"],
  status: "enabled",
  created: 1790899200,
};

const delivery = {
  id: "dlv_6Hm2TcQe",
  endpoint: "whe_3Pk9XvNs",
  event: "charge.succeeded",
  status: "delivered",
  response_status: 200,
  attempts: 1,
  created: 1794182460,
};

export const webhooks = official({
  id: "webhooks",
  name: "Webhooks",
  summary: "Event delivery to your endpoints, with replay",
  description:
    "Webhooks pushes events such as charge.succeeded to HTTPS endpoints you register. Every delivery is signed with an HMAC of the payload using the endpoint's signing secret; failed deliveries retry with backoff for 24 hours and can be replayed by hand.",
  category: "Engagement",
  owner: "Developer experience",
  adapter: "rest",
  version: "1.5.0",
  stability: "stable",
  baseUrl: "https://api.tether.dev/webhooks",
  auth: "hmac",
  rateLimit: 120,
  registeredAt: "2025-01-20T10:10:00Z",
  scopes: [
    { name: "endpoints.read", description: "List webhook endpoints" },
    { name: "endpoints.write", description: "Create endpoints and rotate signing secrets" },
    { name: "deliveries.read", description: "Read delivery attempts" },
    { name: "deliveries.replay", description: "Replay past deliveries" },
  ],
  endpoints: [
    endpoint("webhooks.create-endpoint", "POST", "/v1/endpoints", "Create an endpoint", {
      description: "Registers an HTTPS URL for a set of events. The signing secret is returned once, in this response.",
      scope: "endpoints.write",
      body: { url: "https://hooks.northwind.example/tether", events: ["charge.succeeded", "charge.refunded"] },
      status: 201,
      response: { ...hook, signing_secret: "whsec_Jp4mXc8Rt2Ve6NqLs0Ya" },
    }),
    endpoint("webhooks.list-endpoints", "GET", "/v1/endpoints", "List endpoints", {
      description: "Returns your webhook endpoints without their signing secrets.",
      scope: "endpoints.read",
      params: [query("limit", "integer", "Number of endpoints to return", { example: "2" })],
      response: {
        data: [hook, { ...hook, id: "whe_8Dc4YtRm", url: "https://ops.northwind.example/hooks/messages", events: ["message.delivered", "message.failed"], created: 1788220800 }],
        has_more: false,
        next_cursor: null,
      },
    }),
    endpoint("webhooks.rotate-secret", "POST", "/v1/endpoints/{id}/rotate-secret", "Rotate a signing secret", {
      description: "Issues a new signing secret. The previous secret keeps verifying for 24 hours so you can deploy without dropping events.",
      scope: "endpoints.write",
      params: [path("id", "Endpoint id, starting with whe_", "whe_3Pk9XvNs")],
      status: 200,
      response: { id: "whe_3Pk9XvNs", signing_secret: "whsec_Qa7nVd1Hs5Ke9TmXc3Ub", previous_expires: 1794355200 },
    }),
    endpoint("webhooks.list-deliveries", "GET", "/v1/deliveries", "List deliveries", {
      description: "Returns delivery attempts, newest first. Filter by endpoint or by status to find failures.",
      scope: "deliveries.read",
      params: [query("endpoint", "string", "Only deliveries to this endpoint id", { example: "whe_3Pk9XvNs" }), query("status", "string", "delivered or failed", { example: "failed" }), query("limit", "integer", "Number of deliveries to return", { example: "2" })],
      response: {
        data: [delivery, { ...delivery, id: "dlv_1Wq8RbNk", event: "charge.refunded", status: "failed", response_status: 502, attempts: 4, created: 1794096100 }],
        has_more: true,
        next_cursor: "cur_dlv_1Wq8RbNk",
      },
    }),
    endpoint("webhooks.replay-delivery", "POST", "/v1/deliveries/{id}/replay", "Replay a delivery", {
      description: "Sends the original payload again, with a new signature and timestamp.",
      scope: "deliveries.replay",
      params: [path("id", "Delivery id, starting with dlv_", "dlv_1Wq8RbNk")],
      status: 202,
      response: { id: "dlv_7Fj3ZsHd", replay_of: "dlv_1Wq8RbNk", endpoint: "whe_3Pk9XvNs", event: "charge.refunded", status: "pending", attempts: 0, created: 1794268800 },
    }),
  ],
  changelog: [
    { version: "1.5.0", date: "2026-10-15", note: "Rotating a signing secret keeps the previous one valid for 24 hours" },
    { version: "1.4.0", date: "2026-08-26", note: "Added replay for individual deliveries" },
    { version: "1.3.2", date: "2026-06-03", note: "Retries back off for up to 24 hours instead of 8" },
  ],
});
