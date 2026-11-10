import { endpoint, header, official, path, query } from "../dsl.ts";

const message = {
  id: "msg_6Tc1RbNx",
  channel: "sms",
  to: "+31612345678",
  template: "tpl_order_shipped",
  status: "queued",
  segments: 1,
  created: 1794265200,
};

/** Always times out; the playground uses it to show the failed-upstream path. */
export const MESSAGING_BATCH_ENDPOINT = "messaging.send-batch";

export const messaging = official({
  id: "messaging",
  name: "Messaging",
  summary: "Send SMS, email and push messages from templates",
  description:
    "Messaging delivers transactional messages over SMS, email and push. Messages are accepted immediately and delivered asynchronously; poll the delivery endpoint or subscribe to the message.delivered webhook for the final state.",
  category: "Engagement",
  owner: "Engagement platform",
  adapter: "rest",
  version: "2.4.0",
  stability: "stable",
  baseUrl: "https://api.tether.dev/messaging",
  auth: "api_key",
  rateLimit: 120,
  registeredAt: "2024-07-30T13:00:00Z",
  scopes: [
    { name: "messages.send", description: "Send single and batch messages" },
    { name: "messages.read", description: "Read messages and their delivery status" },
    { name: "templates.read", description: "List message templates" },
  ],
  endpoints: [
    endpoint("messaging.send-message", "POST", "/v2/messages", "Send a message", {
      description: "Queues one message. The channel decides which provider carries it; SMS over 160 characters is split into segments and billed per segment.",
      scope: "messages.send",
      params: [header("Idempotency-Key", "Unique value that makes retries safe", { example: "ship-20418" })],
      body: { channel: "sms", to: "+31612345678", template: "tpl_order_shipped", variables: { order: "20418", eta: "Thursday" } },
      status: 202,
      response: message,
    }),
    endpoint(MESSAGING_BATCH_ENDPOINT, "POST", "/v2/messages/batch", "Send a batch", {
      description: "Queues up to 500 messages in one request. The response lists an accepted or rejected status for each recipient.",
      scope: "messages.send",
      body: { template: "tpl_order_shipped", recipients: [{ to: "+31612345678", variables: { order: "20418" } }, { to: "+31687654321", variables: { order: "20419" } }] },
      status: 202,
      response: { batch: "bat_2Wd8LqPs", accepted: 2, rejected: 0, created: 1794265200 },
    }),
    endpoint("messaging.get-message", "GET", "/v2/messages/{id}", "Retrieve a message", {
      description: "Returns a message and its current state.",
      scope: "messages.read",
      params: [path("id", "Message id, starting with msg_", "msg_6Tc1RbNx")],
      response: { ...message, status: "delivered" },
    }),
    endpoint("messaging.get-delivery", "GET", "/v2/messages/{id}/delivery", "Get delivery status", {
      description: "Returns each delivery attempt with the carrier response. SMS attempts can lag by a minute or more while carrier latency is elevated.",
      scope: "messages.read",
      params: [path("id", "Message id, starting with msg_", "msg_6Tc1RbNx")],
      response: {
        message: "msg_6Tc1RbNx",
        status: "delivered",
        attempts: [
          { at: 1794265204, carrier: "kpn-nl", result: "deferred", code: "queue_full" },
          { at: 1794265262, carrier: "kpn-nl", result: "delivered", code: "ok" },
        ],
      },
    }),
    endpoint("messaging.list-templates", "GET", "/v2/templates", "List templates", {
      description: "Returns the message templates your organisation has approved.",
      scope: "templates.read",
      params: [query("channel", "string", "Only templates for this channel: sms, email or push", { example: "sms" }), query("limit", "integer", "Number of templates to return", { example: "2" })],
      response: {
        data: [
          { id: "tpl_order_shipped", name: "Order shipped", channel: "sms", variables: ["order", "eta"], updated: 1792108800 },
          { id: "tpl_password_reset", name: "Password reset", channel: "email", variables: ["link", "expires_in"], updated: 1790294400 },
        ],
        has_more: false,
        next_cursor: null,
      },
    }),
  ],
  changelog: [
    { version: "2.4.0", date: "2026-10-27", note: "Added the batch endpoint with per-recipient results" },
    { version: "2.3.1", date: "2026-09-14", note: "Delivery attempts include the carrier that handled each attempt" },
    { version: "2.3.0", date: "2026-07-01", note: "Templates accept up to 12 variables" },
  ],
});
