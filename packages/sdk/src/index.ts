/**
 * @tether/sdk — a typed client for the Tether server. It is the only way the
 * web client talks to the server, and any other client (a CLI, a test, a
 * script) can use it the same way.
 */
import {
  API_PREFIX,
  type Activity,
  type Api,
  type ApiHealth,
  type ApiInput,
  type Exchange,
  type ExchangeRequest,
  type Incident,
  type Key,
  type KeyInput,
  type KeySecret,
  type Preferences,
  type PreferencesPatch,
  type RouteDoc,
  type ServerEvent,
  type ServerInfo,
  type Session,
  type Usage,
  type UsageRange,
} from "@tether/contract";

export * from "@tether/contract";

export class TetherError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TetherError";
  }
}

export interface TetherOptions {
  /** Origin of the server, like `http://127.0.0.1:4096`. Empty means same origin. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Current session id. Sent with every call so the server can file what happened under it. */
  session?: () => string | null;
}

export type ConnectionState = "connecting" | "open" | "lost";

export interface Subscription {
  close(): void;
}

export function createTether(options: TetherOptions = {}) {
  const base = (options.baseUrl ?? "").replace(/\/$/, "") + API_PREFIX;
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    const session = options.session?.();
    if (session) headers["x-tether-session"] = session;
    const response = await doFetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? safeParse(text) : null;
    if (!response.ok) {
      const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
      throw new TetherError(response.status, error?.code ?? "request_failed", error?.message ?? response.statusText);
    }
    return data as T;
  }

  const id = encodeURIComponent;

  return {
    server: {
      info: () => call<ServerInfo>("GET", "/server"),
      doc: () => call<RouteDoc[]>("GET", "/doc"),
    },
    api: {
      list: () => call<Api[]>("GET", "/api"),
      get: (apiId: string) => call<Api>("GET", `/api/${id(apiId)}`),
      register: (input: ApiInput) => call<Api>("POST", "/api", input),
      remove: (apiId: string) => call<{ ok: true }>("DELETE", `/api/${id(apiId)}`),
    },
    health: {
      list: () => call<ApiHealth[]>("GET", "/health"),
      incidents: () => call<Incident[]>("GET", "/incident"),
    },
    key: {
      list: () => call<Key[]>("GET", "/key"),
      create: (input: KeyInput) => call<KeySecret>("POST", "/key", input),
      rotate: (keyId: string) => call<KeySecret>("POST", `/key/${id(keyId)}/rotate`),
      revoke: (keyId: string) => call<Key>("POST", `/key/${id(keyId)}/revoke`),
    },
    session: {
      list: () => call<Session[]>("GET", "/session"),
      create: (title?: string) => call<Session>("POST", "/session", { title }),
      rename: (sessionId: string, title: string) => call<Session>("PATCH", `/session/${id(sessionId)}`, { title }),
      remove: (sessionId: string) => call<{ ok: true }>("DELETE", `/session/${id(sessionId)}`),
      exchanges: (sessionId: string) => call<Exchange[]>("GET", `/session/${id(sessionId)}/exchange`),
      activity: (sessionId: string) => call<Activity[]>("GET", `/session/${id(sessionId)}/activity`),
      /** Resolves as soon as the server accepts the request. Progress arrives as `exchange.updated` events. */
      send: (sessionId: string, request: ExchangeRequest) =>
        call<Exchange>("POST", `/session/${id(sessionId)}/exchange`, request),
    },
    usage: {
      get: (range: UsageRange) => call<Usage>("GET", `/usage?range=${range}`),
    },
    preferences: {
      get: () => call<Preferences>("GET", "/preferences"),
      update: (patch: PreferencesPatch) => call<Preferences>("PUT", "/preferences", patch),
    },
    event: {
      /** Opens the event stream. The browser reconnects by itself; `onState` reports each change. */
      subscribe(onEvent: (event: ServerEvent) => void, onState?: (state: ConnectionState) => void): Subscription {
        onState?.("connecting");
        const source = new EventSource(base + "/event");
        source.onopen = () => onState?.("open");
        source.onerror = () => onState?.("lost");
        source.onmessage = (message) => {
          const event = safeParse(message.data) as ServerEvent | null;
          if (event && typeof event.type === "string") onEvent(event);
        };
        return { close: () => source.close() };
      },
    },
  };
}

export type Tether = ReturnType<typeof createTether>;

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
