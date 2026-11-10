import { endpoint, header, official, path, query } from "../dsl.ts";

const account = {
  id: "acc_7Hs0TqWm",
  name: "Operating account",
  currency: "EUR",
  type: "asset",
  status: "open",
  created: 1740787200,
};

export const ledger = official({
  id: "ledger",
  name: "Ledger",
  summary: "Double-entry accounts, balances and transfers",
  description:
    "Ledger records every movement of money as balanced entries between accounts. Balances are derived from entries and never edited directly. Requests are signed with an HMAC of the body so that a transfer cannot be altered in transit.",
  category: "Money",
  owner: "Finance systems",
  adapter: "rest",
  version: "1.8.2",
  stability: "stable",
  baseUrl: "https://api.tether.dev/ledger",
  auth: "hmac",
  rateLimit: 240,
  registeredAt: "2024-05-06T10:15:00Z",
  scopes: [
    { name: "accounts.read", description: "Read accounts and balances" },
    { name: "entries.read", description: "Read journal entries" },
    { name: "transfers.write", description: "Move money between accounts" },
  ],
  endpoints: [
    endpoint("ledger.list-accounts", "GET", "/v1/accounts", "List accounts", {
      description: "Returns accounts in the chart of accounts.",
      scope: "accounts.read",
      params: [query("limit", "integer", "Number of accounts to return", { example: "2" }), query("currency", "string", "Only accounts in this ISO currency code", { example: "EUR" })],
      response: {
        data: [account, { ...account, id: "acc_2Dv9KxEa", name: "Customer funds", type: "liability", created: 1740787200 }],
        has_more: true,
        next_cursor: "cur_acc_2Dv9KxEa",
      },
    }),
    endpoint("ledger.get-balance", "GET", "/v1/accounts/{id}/balance", "Get an account balance", {
      description: "Returns the posted balance and the amount still pending settlement. Pass as_of to read a historic balance.",
      scope: "accounts.read",
      params: [path("id", "Account id, starting with acc_", "acc_7Hs0TqWm"), query("as_of", "string", "ISO 8601 timestamp for a historic balance", { example: "2026-10-31T23:59:59Z" })],
      response: { account: "acc_7Hs0TqWm", currency: "EUR", posted: 18492055, pending: -120000, as_of: "2026-11-10T08:00:00Z" },
    }),
    endpoint("ledger.list-entries", "GET", "/v1/entries", "List journal entries", {
      description: "Returns entries newest first. Every transfer produces at least two entries that sum to zero.",
      scope: "entries.read",
      params: [query("account", "string", "Only entries touching this account id", { example: "acc_7Hs0TqWm" }), query("limit", "integer", "Number of entries to return", { example: "3" })],
      response: {
        data: [
          { id: "ent_9Lk2Wp", transfer: "trf_4Qx7Nc", account: "acc_7Hs0TqWm", amount: -250000, currency: "EUR", posted: 1794182430 },
          { id: "ent_9Lk2Wq", transfer: "trf_4Qx7Nc", account: "acc_2Dv9KxEa", amount: 250000, currency: "EUR", posted: 1794182430 },
          { id: "ent_9Lk1Zr", transfer: "trf_4Qx6Mb", account: "acc_7Hs0TqWm", amount: 84200, currency: "EUR", posted: 1794096000 },
        ],
        has_more: true,
        next_cursor: "cur_ent_9Lk1Zr",
      },
    }),
    endpoint("ledger.create-transfer", "POST", "/v1/transfers", "Create a transfer", {
      description: "Moves an amount from one account to another in a single atomic posting. Fails with 422 when the source account would go below its overdraft limit.",
      scope: "transfers.write",
      params: [header("Idempotency-Key", "Unique value that makes retries safe", { required: true, example: "payout-2026-11-10" }), header("X-Signature", "HMAC-SHA256 of the raw body, hex encoded", { required: true })],
      body: { from: "acc_7Hs0TqWm", to: "acc_2Dv9KxEa", amount: 250000, currency: "EUR", memo: "Payout for week 45" },
      status: 201,
      response: { id: "trf_4Qx7Nc", from: "acc_7Hs0TqWm", to: "acc_2Dv9KxEa", amount: 250000, currency: "EUR", memo: "Payout for week 45", status: "posted", created: 1794182430 },
    }),
    endpoint("ledger.get-transfer", "GET", "/v1/transfers/{id}", "Retrieve a transfer", {
      description: "Returns a transfer and the entries it produced.",
      scope: "entries.read",
      params: [path("id", "Transfer id, starting with trf_", "trf_4Qx7Nc")],
      response: {
        id: "trf_4Qx7Nc",
        from: "acc_7Hs0TqWm",
        to: "acc_2Dv9KxEa",
        amount: 250000,
        currency: "EUR",
        memo: "Payout for week 45",
        status: "posted",
        entries: ["ent_9Lk2Wp", "ent_9Lk2Wq"],
        created: 1794182430,
      },
    }),
  ],
  changelog: [
    { version: "1.8.2", date: "2026-10-08", note: "Fixed as_of balances that skipped entries posted in the same second" },
    { version: "1.8.0", date: "2026-08-19", note: "Transfers accept a memo up to 140 characters" },
    { version: "1.7.0", date: "2026-04-28", note: "Added the pending balance to the balance endpoint" },
  ],
});
