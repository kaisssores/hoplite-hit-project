import {
  createTether,
  type Api,
  type ApiInput,
  type Endpoint,
  type Exchange,
  type KeyInput,
  type KeySecret,
  type Layout,
  type Preferences,
  type PreferencesPatch,
  type ServerEvent,
  type ThemeId,
} from "@tether/sdk";
import { applyTheme, resolveTheme } from "../theme/themes";
import { buildRequest, draftFor, endpointOf } from "./draft";
import { transition, type TransitionKind } from "./motion";
import { parseRoute, routePath, store, type Draft, type Route } from "./store";

/**
 * The sync layer. It is the only module that talks to the server: it loads the
 * state once the event stream opens, folds every server event into the store,
 * and exposes the actions the views call. Views never fetch.
 */
export const tether = createTether({ session: () => store.get().sessionId });

const SESSION_KEY = "tether.session";
const DRAFT_KEY = "tether.draft";

/* ───────────── Boot and event stream ───────────── */

export function connect() {
  tether.event.subscribe(onEvent, (conn) => {
    const was = store.get().conn;
    store.set({ conn });
    // Load on first contact and again after every reconnect, so a restarted server is picked up.
    if (conn === "open" && (was !== "open" || store.get().phase === "booting")) void load();
  });
  window.addEventListener("popstate", () => go(parseRoute(window.location.pathname), { push: false }));
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => applyPrefs(store.get().prefs));
}

async function load() {
  const [server, apis, health, incidents, keys, sessions, prefs] = await Promise.all([
    tether.server.info(),
    tether.api.list(),
    tether.health.list(),
    tether.health.incidents(),
    tether.key.list(),
    tether.session.list(),
    tether.preferences.get(),
  ]);

  let sessionId = store.get().sessionId ?? localStorage.getItem(SESSION_KEY);
  let list = sessions;
  if (!sessionId || !sessions.some((session) => session.id === sessionId)) {
    // Set the id before creating, so the "session started" entry is filed under it.
    const session = await tether.session.create();
    sessionId = session.id;
    list = [session, ...sessions.filter((other) => other.id !== session.id)];
  }
  localStorage.setItem(SESSION_KEY, sessionId);
  const [exchanges, activity] = await Promise.all([
    tether.session.exchanges(sessionId),
    tether.session.activity(sessionId),
  ]);

  applyPrefs(prefs);
  store.set({
    phase: "ready",
    server,
    apis,
    health: Object.fromEntries(health.map((entry) => [entry.apiId, entry])),
    incidents,
    keys,
    sessions: list,
    sessionId,
    exchanges,
    activity,
    bootedAt: Date.now(),
  });
  if (!store.get().draft) restoreDraft();
}

function onEvent(event: ServerEvent) {
  const state = store.get();
  switch (event.type) {
    case "server.connected":
      store.set({ server: event.properties });
      break;
    case "api.updated":
      store.set({ apis: upsert(state.apis, event.properties) });
      break;
    case "api.removed":
      store.set({ apis: state.apis.filter((api) => api.id !== event.properties.id) });
      break;
    case "health.updated":
      store.set({ health: { ...state.health, [event.properties.apiId]: event.properties } });
      break;
    case "key.updated":
      store.set({ keys: upsert(state.keys, event.properties, true) });
      break;
    case "session.updated":
      store.set({ sessions: upsert(state.sessions, event.properties, true) });
      break;
    case "session.removed":
      store.set({ sessions: state.sessions.filter((session) => session.id !== event.properties.id) });
      break;
    case "exchange.updated":
      if (event.properties.sessionId === state.sessionId) putExchange(event.properties);
      break;
    case "activity.created":
      if (event.properties.sessionId === state.sessionId && !state.activity.some((a) => a.id === event.properties.id)) {
        store.set({ activity: [...state.activity, event.properties] });
      }
      break;
    case "preferences.updated":
      // Another client changed them. Our own writes are applied optimistically and their echo is skipped.
      if (pendingWrites === 0 && JSON.stringify(event.properties) !== JSON.stringify(state.prefs)) {
        const themeChanged = event.properties.theme !== state.prefs.theme;
        void transition(themeChanged ? "theme" : "shell", () => applyPrefs(event.properties), {
          origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        });
      }
      break;
  }
}

function upsert<T extends { id: string }>(list: T[], item: T, prepend = false): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return prepend ? [item, ...list] : [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

function putExchange(exchange: Exchange) {
  const { exchanges } = store.get();
  const index = exchanges.findIndex((entry) => entry.id === exchange.id);
  if (index === -1) store.set({ exchanges: [...exchanges, exchange] });
  else {
    // Events can overtake the response of the POST that started the exchange. Never go backwards.
    if (exchanges[index]!.phases.length > exchange.phases.length || exchanges[index]!.state !== "running") return;
    const next = exchanges.slice();
    next[index] = exchange;
    store.set({ exchanges: next });
  }
}

/* ───────────── Preferences ───────────── */

let pendingWrites = 0;

function applyPrefs(prefs: Preferences) {
  const root = document.documentElement;
  applyTheme(resolveTheme(prefs.theme));
  root.dataset.motion = prefs.motion;
  root.dataset.density = prefs.layout.density;
  store.set({ prefs });
}

function writePrefs(patch: PreferencesPatch) {
  pendingWrites += 1;
  tether.preferences
    .update(patch)
    .catch(() => null)
    .finally(() => {
      pendingWrites -= 1;
    });
}

/** Change the layout. The change shows at once and is saved on the server, which tells every other client. */
export function setLayout(patch: Partial<Layout>, kind: TransitionKind | null = "shell") {
  const prefs = store.get().prefs;
  const next = { ...prefs, layout: { ...prefs.layout, ...patch } };
  if (kind) void transition(kind, () => applyPrefs(next));
  else applyPrefs(next);
  writePrefs({ layout: patch });
}

export function setTheme(theme: ThemeId | "system", origin: { x: number; y: number }) {
  const prefs = store.get().prefs;
  if (prefs.theme === theme) return;
  void transition("theme", () => applyPrefs({ ...prefs, theme }), { origin });
  writePrefs({ theme });
}

export function setMotion(motion: Preferences["motion"]) {
  applyPrefs({ ...store.get().prefs, motion });
  writePrefs({ motion });
}

export function saveLayout(name: string) {
  const prefs = store.get().prefs;
  const saved = [...prefs.saved, { id: `rig_${Date.now().toString(36)}`, name, layout: prefs.layout }];
  applyPrefs({ ...prefs, saved });
  writePrefs({ saved });
}

export function removeSavedLayout(id: string) {
  const prefs = store.get().prefs;
  const saved = prefs.saved.filter((entry) => entry.id !== id);
  void transition("flip", () => applyPrefs({ ...prefs, saved }));
  writePrefs({ saved });
}

/* ───────────── Navigation ───────────── */

const scrollMemory = new Map<string, number>();

function direction(from: Route, to: Route): "forward" | "back" | "lateral" {
  if (from.name === "catalog" && to.name === "api") return "forward";
  if (from.name === "api" && to.name === "catalog") return "back";
  if (from.name === "api" && to.name === "playground") return "forward";
  if (from.name === "playground" && to.name === "api") return "back";
  return "lateral";
}

export function go(route: Route, options: { push?: boolean } = {}) {
  const from = store.get().route;
  const fromPath = routePath(from);
  const toPath = routePath(route);
  if (fromPath === toPath) return;
  const main = document.getElementById("main");
  if (main) scrollMemory.set(fromPath, main.scrollTop);
  const dir = direction(from, route);
  const morph = route.name === "api" ? route.id : from.name === "api" ? from.id : store.get().morph;
  if (options.push !== false) window.history.pushState(null, "", toPath);
  // Name the travelling element on the page being left before the snapshot is taken.
  store.set({ morph });
  void transition(
    "route",
    () => {
      store.set({ route, palette: false });
      const target = document.getElementById("main");
      if (target) target.scrollTop = dir === "back" ? (scrollMemory.get(toPath) ?? 0) : 0;
    },
    { dir },
  );
}

/* ───────────── Sessions and exchanges ───────────── */

export async function openSession(id: string) {
  const [exchanges, activity] = await Promise.all([tether.session.exchanges(id), tether.session.activity(id)]);
  localStorage.setItem(SESSION_KEY, id);
  void transition("flip", () =>
    store.set({ sessionId: id, exchanges, activity, activeExchangeId: null, bootedAt: Date.now() }),
  );
}

export async function newSession() {
  const session = await tether.session.create();
  store.set({ sessions: upsert(store.get().sessions, session, true) });
  await openSession(session.id);
}

export async function renameSession(id: string, title: string) {
  const session = await tether.session.rename(id, title);
  store.set({ sessions: upsert(store.get().sessions, session) });
}

export async function removeSession(id: string) {
  await tether.session.remove(id);
  const sessions = store.get().sessions.filter((session) => session.id !== id);
  void transition("flip", () => store.set({ sessions }));
  if (store.get().sessionId === id) {
    if (sessions[0]) await openSession(sessions[0].id);
    else await newSession();
  }
}

export async function send() {
  const { draft, sessionId, sending } = store.get();
  if (!draft || !sessionId || sending) return;
  store.set({ sending: true });
  try {
    const exchange = await tether.session.send(sessionId, buildRequest(draft));
    putExchange(exchange);
    store.set({ activeExchangeId: exchange.id });
  } finally {
    store.set({ sending: false });
  }
}

/* ───────────── The request draft ───────────── */

export function setDraft(patch: Partial<Draft>) {
  const draft = store.get().draft;
  if (!draft) return;
  const next = { ...draft, ...patch };
  store.set({ draft: next });
  localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
}

/** Point the playground at an endpoint and fill the request from its documentation. */
export function compose(api: Api, endpoint: Endpoint | null) {
  const { keys, draft } = store.get();
  const next = draftFor(api, endpoint, keys, draft);
  store.set({ draft: next, activeExchangeId: null });
  localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
}

/** Load a past exchange back into the playground, with its result. */
export function recall(exchange: Exchange) {
  const { apis, keys, draft } = store.get();
  const api = apis.find((entry) => entry.id === exchange.request.apiId);
  if (!api) return;
  const endpoint = endpointOf(api, exchange.request.endpointId);
  const base = draftFor(api, endpoint, keys, draft);
  const params = exchange.request;
  const query = Object.entries(params.query).map(([k, v]) => ({ k, v, on: true }));
  const next: Draft = {
    ...base,
    method: params.method,
    path: endpoint ? endpoint.path : params.path,
    query: [...query, ...base.query.filter((row) => !(row.k in params.query)).map((row) => ({ ...row, on: false }))],
    body: params.body ?? "",
    keyId: params.keyId,
    env: params.env,
  };
  if (endpoint) {
    // Recover path parameter values by matching the sent path against the template.
    const names = [...endpoint.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
    const pattern = new RegExp("^" + endpoint.path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{\w+\\?\}/g, "([^/]+)") + "$");
    const found = pattern.exec(params.path);
    if (found) names.forEach((name, index) => (next.pathParams[name] = decodeURIComponent(found[index + 1] ?? "")));
  }
  store.set({ draft: next, activeExchangeId: exchange.id });
  localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
}

function restoreDraft() {
  const { apis, keys } = store.get();
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
    if (saved && apis.some((api) => api.id === saved.apiId)) {
      store.set({ draft: saved });
      return;
    }
  } catch {
    // A draft that no longer parses is dropped.
  }
  const api = apis.find((entry) => entry.id === "payments") ?? apis[0];
  if (!api) return;
  const endpoint = api.endpoints.find((entry) => entry.method === "POST") ?? api.endpoints[0] ?? null;
  store.set({ draft: draftFor(api, endpoint, keys, null) });
}

/* ───────────── Catalog and keys ───────────── */

export async function registerApi(input: ApiInput): Promise<Api> {
  const api = await tether.api.register(input);
  void transition("flip", () => store.set({ apis: upsert(store.get().apis, api) }));
  const health = await tether.health.list();
  store.set({ health: Object.fromEntries(health.map((entry) => [entry.apiId, entry])) });
  return api;
}

export async function removeApi(id: string) {
  await tether.api.remove(id);
  store.set({ apis: store.get().apis.filter((api) => api.id !== id) });
}

export async function createKey(input: KeyInput): Promise<KeySecret> {
  const result = await tether.key.create(input);
  void transition("flip", () => store.set({ keys: upsert(store.get().keys, result.key, true) }));
  return result;
}

export async function rotateKey(id: string): Promise<KeySecret> {
  const result = await tether.key.rotate(id);
  store.set({ keys: upsert(store.get().keys, result.key) });
  return result;
}

export async function revokeKey(id: string) {
  const key = await tether.key.revoke(id);
  store.set({ keys: upsert(store.get().keys, key) });
}
