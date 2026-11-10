import { endpoint, header, official, path, query } from "../dsl.ts";

const charge = {
  id: "ch_3Nf8Qa2eZvKYlo2C",
  object: "charge",
  amount: 4200,
  currency: "eur",
  status: "succeeded",
  captured: true,
  customer: "cus_Pq7R2xLm9a",
  description: "Order 20418, annual plan",
  payment_method: "pm_1Mt0Xc2eZvKYlo",
  receipt_url: "https://pay.tether.dev/receipts/rcpt_9Fz2",
  livemode: true,
  created: 1794182400,
};

export const payments = official({
  id: "payments",
  name: "Payments",
  summary: "Charge cards and wallets, capture, refund",
  description:
    "Payments takes money from a customer's payment method and tells you what happened. Charges can be captured immediately or authorised first and captured later; refunds can be partial. Amounts are integers in the currency's smallest unit.",
  category: "Money",
  owner: "Payments core",
  adapter: "rest",
  version: "2026-09-01",
  stability: "stable",
  baseUrl: "https://api.tether.dev/payments",
  auth: "api_key",
  rateLimit: 300,
  registeredAt: "2024-01-22T08:30:00Z",
  scopes: [
    { name: "charges.read", description: "Retrieve and list charges" },
    { name: "charges.write", description: "Create and capture charges" },
    { name: "refunds.write", description: "Refund captured charges" },
  ],
  endpoints: [
    endpoint("payments.create-charge", "POST", "/v1/charges", "Create a charge", {
      description: "Charges a payment method. Set capture to false to authorise now and capture within seven days. Send an Idempotency-Key so a retry never double-charges.",
      scope: "charges.write",
      params: [header("Idempotency-Key", "Unique value that makes retries safe", { required: true, example: "order-20418-attempt-1" })],
      body: { amount: 4200, currency: "eur", customer: "cus_Pq7R2xLm9a", payment_method: "pm_1Mt0Xc2eZvKYlo", description: "Order 20418, annual plan", capture: true },
      status: 201,
      response: charge,
    }),
    endpoint("payments.get-charge", "GET", "/v1/charges/{id}", "Retrieve a charge", {
      description: "Returns a charge by id, including its capture and refund state.",
      scope: "charges.read",
      params: [path("id", "Charge id, starting with ch_", "ch_3Nf8Qa2eZvKYlo2C")],
      response: charge,
    }),
    endpoint("payments.list-charges", "GET", "/v1/charges", "List charges", {
      description: "Returns charges, newest first. Filter by customer or by creation window with created_gte.",
      scope: "charges.read",
      params: [
        query("limit", "integer", "Number of charges to return, from 1 to 100", { example: "3" }),
        query("customer", "string", "Only charges for this customer id", { example: "cus_Pq7R2xLm9a" }),
        query("created_gte", "integer", "Unix timestamp; only charges created at or after it"),
        query("cursor", "string", "Cursor from the previous page"),
      ],
      response: {
        data: [
          charge,
          { ...charge, id: "ch_3Nf7Lb2eZvKYlo1A", amount: 1899, currency: "eur", customer: "cus_Zt3K8wNd1c", description: "Order 20417, monthly plan", created: 1794096000 },
          { ...charge, id: "ch_3Nf6Hc2eZvKYlo0B", amount: 12900, currency: "usd", customer: "cus_Ab9X4mQe7r", status: "pending", captured: false, description: "Order 20412, authorisation hold", created: 1794009600 },
        ],
        has_more: true,
        next_cursor: "cur_ch_3Nf6Hc2eZvKYlo0B",
      },
    }),
    endpoint("payments.refund-charge", "POST", "/v1/charges/{id}/refund", "Refund a charge", {
      description: "Returns all or part of a captured charge to the customer. Omit amount to refund the remainder.",
      scope: "refunds.write",
      params: [path("id", "Charge id, starting with ch_", "ch_3Nf8Qa2eZvKYlo2C"), header("Idempotency-Key", "Unique value that makes retries safe", { required: true, example: "refund-20418-1" })],
      body: { amount: 1500, reason: "requested_by_customer" },
      status: 201,
      response: { id: "re_1Pk3Yd2eZvKYlo", object: "refund", charge: "ch_3Nf8Qa2eZvKYlo2C", amount: 1500, currency: "eur", reason: "requested_by_customer", status: "succeeded", created: 1794268500 },
    }),
    endpoint("payments.capture-charge", "POST", "/v1/charges/{id}/capture", "Capture an authorised charge", {
      description: "Captures a charge created with capture set to false. The captured amount can be lower than the authorised amount, never higher.",
      scope: "charges.write",
      params: [path("id", "Charge id, starting with ch_", "ch_3Nf6Hc2eZvKYlo0B")],
      body: { amount: 12900 },
      status: 200,
      response: { ...charge, id: "ch_3Nf6Hc2eZvKYlo0B", amount: 12900, currency: "usd", description: "Order 20412, authorisation hold", created: 1794009600 },
    }),
  ],
  changelog: [
    { version: "2026-09-01", date: "2026-09-01", note: "Charges expose receipt_url; refunds accept reason values from a fixed list" },
    { version: "2026-06-10", date: "2026-06-10", note: "Idempotency keys are retained for 48 hours instead of 24" },
    { version: "2026-03-03", date: "2026-03-03", note: "Added capture: false for authorise-then-capture flows" },
  ],
});
