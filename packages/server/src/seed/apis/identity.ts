import { endpoint, header, official, path, query } from "../dsl.ts";

const user = {
  id: "usr_8Hq2LmXc4Tn",
  email: "amara.okafor@northwind.example",
  name: "Amara Okafor",
  status: "active",
  mfa_enabled: true,
  created: 1782345600,
  last_login: 1794214320,
};

export const identity = official({
  id: "identity",
  name: "Identity",
  summary: "Accounts, sign-in sessions and token introspection",
  description:
    "Identity is the system of record for people and the credentials they sign in with. Use it to look up or create accounts, end sign-in sessions, and check whether an access token is still valid before trusting it.",
  category: "Accounts",
  owner: "Identity platform",
  adapter: "rest",
  version: "3.2.0",
  stability: "stable",
  baseUrl: "https://api.tether.dev/identity/v3",
  auth: "bearer",
  rateLimit: 600,
  registeredAt: "2024-03-12T09:00:00Z",
  scopes: [
    { name: "users.read", description: "Read account profiles and sign-in sessions" },
    { name: "users.write", description: "Create and update accounts" },
    { name: "sessions.write", description: "End sign-in sessions" },
    { name: "tokens.introspect", description: "Check whether an access token is active" },
  ],
  endpoints: [
    endpoint("identity.list-users", "GET", "/users", "List users", {
      description: "Returns accounts in creation order, newest first. Page with the cursor returned in the previous response.",
      scope: "users.read",
      params: [
        query("limit", "integer", "Number of users to return, from 1 to 100", { example: "2" }),
        query("cursor", "string", "Cursor from the previous page"),
        query("email", "string", "Return only the account with this exact email"),
      ],
      response: {
        data: [user, { ...user, id: "usr_3Zw9PdRb7Kv", email: "tomasz.wrona@northwind.example", name: "Tomasz Wrona", mfa_enabled: false, created: 1781740800, last_login: 1794127900 }],
        has_more: true,
        next_cursor: "cur_usr_3Zw9PdRb7Kv",
      },
    }),
    endpoint("identity.get-user", "GET", "/users/{id}", "Retrieve a user", {
      description: "Returns one account by id.",
      scope: "users.read",
      params: [path("id", "User id, starting with usr_", "usr_8Hq2LmXc4Tn")],
      response: user,
    }),
    endpoint("identity.create-user", "POST", "/users", "Create a user", {
      description: "Creates an account and sends the verification email. Fails with 409 when the email is already registered.",
      scope: "users.write",
      params: [header("Idempotency-Key", "Unique value that makes retries safe", { example: "signup-4417" })],
      body: { email: "dara.eze@northwind.example", name: "Dara Eze", mfa_enabled: false },
      status: 201,
      response: { ...user, id: "usr_5Nb1VkTe0Qs", email: "dara.eze@northwind.example", name: "Dara Eze", status: "pending", mfa_enabled: false, created: 1794268700, last_login: null },
    }),
    endpoint("identity.list-user-sessions", "GET", "/users/{id}/sessions", "List a user's sessions", {
      description: "Returns the active sign-in sessions for an account, with the device and network each one started from.",
      scope: "users.read",
      params: [path("id", "User id, starting with usr_", "usr_8Hq2LmXc4Tn"), query("limit", "integer", "Number of sessions to return", { example: "2" })],
      response: {
        data: [
          { id: "ses_Qm40ZxN8aVc", device: "Safari on macOS", ip: "203.0.113.42", created: 1794214320, expires: 1794819120 },
          { id: "ses_Hd72TgL5pWe", device: "Tether app on Android", ip: "198.51.100.17", created: 1793610000, expires: 1794214800 },
        ],
        has_more: false,
        next_cursor: null,
      },
    }),
    endpoint("identity.end-session", "DELETE", "/sessions/{id}", "End a session", {
      description: "Signs the device out immediately. Access tokens issued for the session stop validating within a few seconds.",
      scope: "sessions.write",
      params: [path("id", "Session id, starting with ses_", "ses_Qm40ZxN8aVc")],
      status: 204,
      response: null,
    }),
    endpoint("identity.introspect-token", "POST", "/tokens/introspect", "Introspect a token", {
      description: "Reports whether an access token is active and, if so, whom it belongs to and what it allows.",
      scope: "tokens.introspect",
      body: { token: "eyJhbGciOiJFUzI1NiIsImtpZCI6Im5vcnRod2luZC0yMDI2In0.e30.Zq8" },
      response: { active: true, sub: "usr_8Hq2LmXc4Tn", scope: "users.read sessions.write", client_id: "web-console", exp: 1794272400, iat: 1794268800 },
    }),
  ],
  changelog: [
    { version: "3.2.0", date: "2026-10-21", note: "Added the mfa_enabled field to user objects and the email filter on list users" },
    { version: "3.1.2", date: "2026-09-02", note: "Token introspection now returns client_id for tokens issued to confidential clients" },
    { version: "3.1.0", date: "2026-06-17", note: "Sessions can be ended individually with DELETE /sessions/{id}" },
    { version: "3.0.0", date: "2026-02-04", note: "Cursor pagination replaces page numbers on every list endpoint" },
  ],
});
