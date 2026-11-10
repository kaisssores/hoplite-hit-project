import { useSyncExternalStore } from "react";
import {
  DEFAULT_PREFERENCES,
  type Activity,
  type Api,
  type ApiHealth,
  type ConnectionState,
  type Env,
  type Exchange,
  type Incident,
  type Key,
  type Method,
  type Preferences,
  type ServerInfo,
  type Session,
} from "@tether/sdk";

export type Route =
  | { name: "catalog" }
  | { name: "api"; id: string }
  | { name: "playground" }
  | { name: "keys" }
  | { name: "usage" }
  | { name: "sessions" }
  | { name: "workbench" };

export type Sheet = null | { type: "key"; apiId?: string } | { type: "register" };

export interface Row {
  k: string;
  v: string;
  on: boolean;
}

/** The request being composed in the playground. Local to this client until it is sent. */
export interface Draft {
  apiId: string;
  endpointId: string | null;
  method: Method;
  /** Path template, with `{param}` placeholders. */
  path: string;
  pathParams: Record<string, string>;
  query: Row[];
  headers: Row[];
  body: string;
  keyId: string | null;
  env: Env;
}

/**
 * The client's mirror of server state plus what belongs to this window only
 * (route, open sheet, the request draft). Server state is written by `sync.ts`
 * alone, from responses and from the event stream.
 */
export interface State {
  phase: "booting" | "ready";
  conn: ConnectionState;
  server: ServerInfo | null;
  apis: Api[];
  health: Record<string, ApiHealth>;
  incidents: Incident[];
  keys: Key[];
  sessions: Session[];
  sessionId: string | null;
  exchanges: Exchange[];
  activity: Activity[];
  prefs: Preferences;
  bootedAt: number;

  route: Route;
  /** The API whose name travels between its catalog row and its page. */
  morph: string | null;
  rig: boolean;
  palette: boolean;
  sheet: Sheet;
  draft: Draft | null;
  activeExchangeId: string | null;
  sending: boolean;
}

type Listener = () => void;

function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((current: T) => Partial<T>)) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      for (const listener of listeners) listener();
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function parseRoute(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "api" && parts[1]) return { name: "api", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "playground") return { name: "playground" };
  if (parts[0] === "keys") return { name: "keys" };
  if (parts[0] === "usage") return { name: "usage" };
  if (parts[0] === "sessions") return { name: "sessions" };
  if (parts[0] === "workbench") return { name: "workbench" };
  return { name: "catalog" };
}

export function routePath(route: Route): string {
  if (route.name === "catalog") return "/";
  if (route.name === "api") return `/api/${encodeURIComponent(route.id)}`;
  return `/${route.name}`;
}

const initialRoute = parseRoute(window.location.pathname);

export const store = createStore<State>({
  phase: "booting",
  conn: "connecting",
  server: null,
  apis: [],
  health: {},
  incidents: [],
  keys: [],
  sessions: [],
  sessionId: null,
  exchanges: [],
  activity: [],
  prefs: DEFAULT_PREFERENCES,
  bootedAt: Date.now(),
  route: initialRoute,
  morph: initialRoute.name === "api" ? initialRoute.id : null,
  rig: false,
  palette: false,
  sheet: null,
  draft: null,
  activeExchangeId: null,
  sending: false,
});

/** Subscribe a component to one slice. Selectors must return a stored reference or a primitive. */
export function useStore<S>(selector: (state: State) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
