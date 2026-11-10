/**
 * The Tether contract: every shape that crosses the wire between the server
 * (which owns state) and any client. The server, the SDK and the web client
 * all import from here and from nowhere else.
 */

export const TETHER_VERSION = "0.1.0";
export const DEFAULT_PORT = 4096;
export const API_PREFIX = "/v1";

/* ───────────── Catalog ───────────── */

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** How the server reaches an API. Each id maps to one adapter on the server. */
export type AdapterId = "rest" | "graphql" | "loopback" | "http";

export type AuthScheme = "api_key" | "bearer" | "hmac" | "none";
export type Stability = "stable" | "beta" | "deprecated";
export type Origin = "official" | "registered" | "hub";
export type Env = "live" | "test";

export interface Param {
  name: string;
  in: "path" | "query" | "header";
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

export interface Endpoint {
  id: string;
  method: Method;
  /** Path relative to the API base URL, with `{param}` placeholders. */
  path: string;
  summary: string;
  description: string;
  params: Param[];
  /** Scope a key needs, without the API prefix. `null` means any valid key. */
  scope: string | null;
  /** Example JSON request body, when the endpoint takes one. */
  requestBody?: unknown;
  response: { status: number; body: unknown };
}

export interface Scope {
  name: string;
  description: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  note: string;
}

export interface Api {
  id: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  owner: string;
  origin: Origin;
  adapter: AdapterId;
  version: string;
  stability: Stability;
  baseUrl: string;
  auth: AuthScheme;
  scopes: Scope[];
  /** Requests per minute per key. */
  rateLimit: number;
  endpoints: Endpoint[];
  changelog: ChangelogEntry[];
  registeredAt: number;
}

export interface ApiInput {
  name: string;
  summary: string;
  category: string;
  baseUrl: string;
  auth: AuthScheme;
  /** `simulated` answers from the server; `live` forwards over HTTP. */
  upstream: "simulated" | "live";
  endpoints: { method: Method; path: string; summary: string }[];
}

/* ───────────── Health ───────────── */

export type HealthStatus = "operational" | "degraded" | "outage" | "maintenance";

export interface HealthSample {
  t: number;
  p50: number;
  p95: number;
  requests: number;
  errors: number;
}

export interface ApiHealth {
  apiId: string;
  status: HealthStatus;
  note: string | null;
  p50: number;
  p95: number;
  /** 0–1 over the last 24 hours. */
  errorRate: number;
  /** Percent over the last 30 days. */
  uptime: number;
  requests24h: number;
  /** 48 half-hour samples, oldest first. The last one is still filling. */
  history: HealthSample[];
}

export interface IncidentUpdate {
  at: number;
  text: string;
}

export interface Incident {
  id: string;
  apiId: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved" | "scheduled";
  startedAt: number;
  resolvedAt: number | null;
  updates: IncidentUpdate[];
}

/* ───────────── Credentials ───────────── */

export interface Key {
  id: string;
  name: string;
  env: Env;
  /** Public part of the secret, safe to show, like `tth_live_8f3k`. */
  prefix: string;
  last4: string;
  /** Full scope names, `apiId:scope`. */
  scopes: string[];
  apiIds: string[];
  status: "active" | "revoked";
  createdAt: number;
  lastUsedAt: number | null;
  rotatedAt: number | null;
  requests: number;
}

export interface KeyInput {
  name: string;
  env: Env;
  apiIds: string[];
  scopes: string[];
}

/** Returned once, on create and on rotate. The server keeps only a hash. */
export interface KeySecret {
  key: Key;
  secret: string;
}

/* ───────────── Sessions and exchanges ───────────── */

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  exchanges: number;
}

export interface ExchangeRequest {
  apiId: string;
  endpointId: string | null;
  method: Method;
  /** Path with parameters already substituted, relative to the base URL. */
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string | null;
  keyId: string | null;
  env: Env;
}

/** The four stretches of line a request travels, in order. */
export type Hop = "queue" | "auth" | "upstream" | "transfer";
export const HOPS: Hop[] = ["queue", "auth", "upstream", "transfer"];

export interface Phase {
  hop: Hop;
  startedAt: number;
  /** `null` while the hop is still in flight. */
  ms: number | null;
}

export interface ExchangeResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
}

export interface ExchangeError {
  hop: Hop;
  code: string;
  message: string;
}

export interface Exchange {
  id: string;
  sessionId: string;
  adapter: AdapterId;
  request: ExchangeRequest;
  url: string;
  /** `done` means a response came back, whatever its status. `failed` means none did. */
  state: "running" | "done" | "failed";
  phases: Phase[];
  response: ExchangeResponse | null;
  error: ExchangeError | null;
  startedAt: number;
  ms: number | null;
}

export type ActivityKind =
  | "session.started"
  | "exchange"
  | "key.created"
  | "key.rotated"
  | "key.revoked"
  | "api.registered"
  | "api.removed"
  | "layout.saved";

export interface Activity {
  id: string;
  sessionId: string;
  at: number;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  ref: { type: "exchange" | "key" | "api"; id: string } | null;
}

/* ───────────── Usage ───────────── */

export type UsageRange = "24h" | "7d" | "30d";

export interface UsageBucket {
  t: number;
  requests: number;
  errors: number;
}

export interface Usage {
  range: UsageRange;
  buckets: UsageBucket[];
  /** The same range one period earlier, for the comparison line. */
  previous: UsageBucket[];
  totals: { requests: number; errors: number; p50: number; previousRequests: number };
  byApi: { apiId: string; requests: number; errors: number; p50: number }[];
  byKey: { keyId: string; requests: number }[];
  quota: { used: number; limit: number; resetsAt: number };
}

/* ───────────── Account ───────────── */

/** The person using this server. The prototype has one account and no passwords. */
export interface Account {
  name: string;
  email: string;
  team: string;
  createdAt: number;
}

export type AccountInput = Pick<Account, "name" | "email" | "team">;

/* ───────────── Preferences: theme and layout ───────────── */

export type ThemeId = "haze" | "haze-night" | "night-watch" | "chart-room" | "deep-water" | "signal";
export const THEME_IDS: ThemeId[] = ["haze", "haze-night", "night-watch", "chart-room", "deep-water", "signal"];

export type CatalogColumn = "category" | "auth" | "version" | "status" | "latency" | "traffic";
export const CATALOG_COLUMNS: CatalogColumn[] = ["category", "auth", "version", "status", "latency", "traffic"];

export type ApiModule = "health" | "endpoints" | "auth" | "changelog";
export type UsageModule = "traffic" | "by-api" | "quota" | "by-key" | "incidents";

export interface ModuleState<Id extends string = string> {
  id: Id;
  hidden: boolean;
}

export interface Layout {
  nav: "left" | "right" | "top";
  navCollapsed: boolean;
  navWidth: number;
  dock: "right" | "bottom" | "hidden";
  dockSize: number;
  density: "compact" | "regular";
  /** Playground: request and response side by side, or stacked. */
  bench: "columns" | "rows";
  benchRatio: number;
  catalog: { group: "none" | "category"; columns: CatalogColumn[] };
  modules: { api: ModuleState<ApiModule>[]; usage: ModuleState<UsageModule>[] };
}

export interface SavedLayout {
  id: string;
  name: string;
  layout: Layout;
}

export interface Preferences {
  theme: ThemeId | "system";
  motion: "system" | "full" | "reduced";
  layout: Layout;
  saved: SavedLayout[];
}

export type PreferencesPatch = Partial<Omit<Preferences, "layout">> & { layout?: Partial<Layout> };

export const DEFAULT_LAYOUT: Layout = {
  nav: "left",
  navCollapsed: false,
  navWidth: 248,
  dock: "right",
  dockSize: 320,
  density: "regular",
  bench: "columns",
  benchRatio: 0.46,
  catalog: { group: "none", columns: ["auth", "status", "latency", "traffic"] },
  modules: {
    api: [
      { id: "health", hidden: false },
      { id: "endpoints", hidden: false },
      { id: "auth", hidden: false },
      { id: "changelog", hidden: false },
    ],
    usage: [
      { id: "traffic", hidden: false },
      { id: "by-api", hidden: false },
      { id: "quota", hidden: false },
      { id: "by-key", hidden: false },
      { id: "incidents", hidden: false },
    ],
  },
};

/** Built-in rigs. Each is a full layout, so applying one is a single write. */
export const LAYOUT_PRESETS: { id: string; name: string; hint: string; layout: Layout }[] = [
  { id: "browse", name: "Browse", hint: "Wide index, activity alongside", layout: DEFAULT_LAYOUT },
  {
    id: "bench",
    name: "Bench",
    hint: "Collapsed rail, activity under the request",
    layout: {
      ...DEFAULT_LAYOUT,
      navCollapsed: true,
      dock: "bottom",
      dockSize: 220,
      density: "compact",
      bench: "columns",
      benchRatio: 0.42,
      catalog: { group: "none", columns: ["auth", "status", "latency"] },
      modules: {
        api: [
          { id: "endpoints", hidden: false },
          { id: "auth", hidden: false },
          { id: "health", hidden: false },
          { id: "changelog", hidden: true },
        ],
        usage: DEFAULT_LAYOUT.modules.usage,
      },
    },
  },
  {
    id: "watch",
    name: "Watch",
    hint: "Top bar, no dock, health first",
    layout: {
      ...DEFAULT_LAYOUT,
      nav: "top",
      dock: "hidden",
      bench: "rows",
      benchRatio: 0.5,
      catalog: { group: "category", columns: ["status", "latency", "traffic"] },
      modules: {
        api: [
          { id: "health", hidden: false },
          { id: "changelog", hidden: false },
          { id: "endpoints", hidden: false },
          { id: "auth", hidden: true },
        ],
        usage: [
          { id: "incidents", hidden: false },
          { id: "traffic", hidden: false },
          { id: "by-api", hidden: false },
          { id: "quota", hidden: false },
          { id: "by-key", hidden: true },
        ],
      },
    },
  },
];

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "haze",
  motion: "system",
  layout: DEFAULT_LAYOUT,
  saved: [],
};

/* ───────────── Server ───────────── */

export interface AdapterInfo {
  id: AdapterId;
  label: string;
  description: string;
  /** `false` when the adapter answers from the server instead of the network. */
  live: boolean;
}

export interface ServerInfo {
  version: string;
  startedAt: number;
  dataPath: string;
  adapters: AdapterInfo[];
}

/** Everything the server pushes over `GET /v1/event`. One JSON object per SSE message. */
export type ServerEvent =
  | { type: "server.connected"; properties: ServerInfo }
  | { type: "server.heartbeat"; properties: { at: number } }
  | { type: "api.updated"; properties: Api }
  | { type: "api.removed"; properties: { id: string } }
  | { type: "health.updated"; properties: ApiHealth }
  | { type: "key.updated"; properties: Key }
  | { type: "session.updated"; properties: Session }
  | { type: "session.removed"; properties: { id: string } }
  | { type: "exchange.updated"; properties: Exchange }
  | { type: "activity.created"; properties: Activity }
  | { type: "preferences.updated"; properties: Preferences }
  | { type: "account.updated"; properties: Account | null };

export interface RouteDoc {
  method: Method;
  path: string;
  summary: string;
  returns: string;
}

/** The server's own surface. Served at `GET /v1/doc` and listed in the catalog as the Hub API. */
export const ROUTES: RouteDoc[] = [
  { method: "GET", path: "/v1/server", summary: "Server version, start time and adapters", returns: "ServerInfo" },
  { method: "GET", path: "/v1/doc", summary: "This route table", returns: "RouteDoc[]" },
  { method: "GET", path: "/v1/event", summary: "Server-sent stream of every state change", returns: "stream of ServerEvent" },
  { method: "GET", path: "/v1/api", summary: "List the catalog", returns: "Api[]" },
  { method: "GET", path: "/v1/api/{id}", summary: "Read one API with its endpoints", returns: "Api" },
  { method: "POST", path: "/v1/api", summary: "Register an API", returns: "Api" },
  { method: "DELETE", path: "/v1/api/{id}", summary: "Remove a registered API", returns: "{ ok: true }" },
  { method: "GET", path: "/v1/health", summary: "Health of every API", returns: "ApiHealth[]" },
  { method: "GET", path: "/v1/incident", summary: "Open and recent incidents", returns: "Incident[]" },
  { method: "GET", path: "/v1/key", summary: "List keys, without secrets", returns: "Key[]" },
  { method: "POST", path: "/v1/key", summary: "Create a key and return its secret once", returns: "KeySecret" },
  { method: "POST", path: "/v1/key/{id}/rotate", summary: "Replace a key's secret", returns: "KeySecret" },
  { method: "POST", path: "/v1/key/{id}/revoke", summary: "Revoke a key", returns: "Key" },
  { method: "GET", path: "/v1/session", summary: "List sessions, newest first", returns: "Session[]" },
  { method: "POST", path: "/v1/session", summary: "Start a session", returns: "Session" },
  { method: "PATCH", path: "/v1/session/{id}", summary: "Rename a session", returns: "Session" },
  { method: "DELETE", path: "/v1/session/{id}", summary: "Delete a session and its history", returns: "{ ok: true }" },
  { method: "GET", path: "/v1/session/{id}/exchange", summary: "Requests sent in a session", returns: "Exchange[]" },
  { method: "POST", path: "/v1/session/{id}/exchange", summary: "Send a request through an adapter", returns: "Exchange" },
  { method: "GET", path: "/v1/session/{id}/activity", summary: "Everything that happened in a session", returns: "Activity[]" },
  { method: "GET", path: "/v1/usage", summary: "Traffic for a range: 24h, 7d or 30d", returns: "Usage" },
  { method: "GET", path: "/v1/preferences", summary: "Theme, motion and layout", returns: "Preferences" },
  { method: "PUT", path: "/v1/preferences", summary: "Patch theme, motion or layout", returns: "Preferences" },
  { method: "GET", path: "/v1/account", summary: "The account on this server, or null before registration", returns: "Account | null" },
  { method: "PUT", path: "/v1/account", summary: "Register, or update name, email and team", returns: "Account" },
  { method: "DELETE", path: "/v1/account", summary: "Sign out and forget the account", returns: "{ ok: true }" },
];
