import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  DEFAULT_LAYOUT,
  DEFAULT_PREFERENCES,
  type Activity,
  type ActivityKind,
  type Api,
  type Exchange,
  type Incident,
  type Key,
  type Preferences,
  type Session,
} from "@tether/contract";
import type { Bus } from "./bus.ts";
import { OFFICIAL_APIS } from "./seed/catalog.ts";
import { buildHub } from "./seed/hub.ts";
import { buildIncidents } from "./seed/incidents.ts";
import { buildKeys } from "./seed/keys.ts";
import { buildSession } from "./seed/sessions.ts";
import type { Persisted, StoredKey, UsageHour } from "./state.ts";
import { clone, defaultSessionTitle, DAY, HOUR, newId } from "./util.ts";

const SAVE_DELAY_MS = 150;
const MAX_EXCHANGES_PER_SESSION = 200;
const MAX_ACTIVITY_PER_SESSION = 500;
const USAGE_RETENTION_MS = 62 * DAY;

export interface StoreOptions {
  dataPath: string;
  /** Port the hub API advertises as its base URL. */
  port: number;
  now?: () => number;
}

function isPersisted(value: unknown): value is Persisted {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<Persisted>;
  return (
    v.version === 1 &&
    Array.isArray(v.registered) &&
    Array.isArray(v.keys) &&
    Array.isArray(v.sessions) &&
    Array.isArray(v.exchanges) &&
    Array.isArray(v.activity) &&
    typeof v.preferences === "object" &&
    v.preferences !== null &&
    typeof v.usage === "object" &&
    v.usage !== null
  );
}

function seed(now: number): Persisted {
  const { session, exchanges, activity } = buildSession(now);
  return {
    version: 1,
    registered: [],
    keys: buildKeys(now),
    sessions: [session],
    exchanges,
    activity,
    preferences: clone(DEFAULT_PREFERENCES),
    usage: {},
  };
}

function load(path: string): Persisted | null {
  if (!existsSync(path)) return null;
  try {
    const data: unknown = JSON.parse(readFileSync(path, "utf8"));
    return isPersisted(data) ? data : null;
  } catch {
    return null;
  }
}

/** The one owner of state. Every mutation goes through here, emits an event, and schedules a save. */
export class Store {
  readonly dataPath: string;
  readonly startedAt: number;
  readonly incidents: Incident[];

  private readonly now: () => number;
  private readonly official: Api[];
  private registered = new Map<string, Api>();
  private keys = new Map<string, StoredKey>();
  private sessions = new Map<string, Session>();
  private exchanges = new Map<string, Exchange[]>();
  private activity = new Map<string, Activity[]>();
  private preferences: Preferences;
  private usage: Record<string, UsageHour>;
  private timer: NodeJS.Timeout | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    options: StoreOptions,
    private bus: Bus,
  ) {
    this.now = options.now ?? Date.now;
    this.dataPath = options.dataPath;
    this.startedAt = this.now();
    this.official = [...OFFICIAL_APIS, buildHub(options.port)];
    this.incidents = buildIncidents(this.now());

    const state = load(options.dataPath) ?? seed(this.now());
    for (const api of state.registered) this.registered.set(api.id, api);
    for (const stored of state.keys) this.keys.set(stored.key.id, stored);
    for (const session of state.sessions) this.sessions.set(session.id, session);
    for (const exchange of state.exchanges) this.pushExchange(this.settleInterrupted(exchange));
    for (const entry of state.activity) this.pushActivity(entry);
    this.preferences = { ...clone(DEFAULT_PREFERENCES), ...state.preferences, layout: { ...clone(DEFAULT_LAYOUT), ...state.preferences.layout } };
    this.usage = state.usage;
  }

  /* ───────── catalog ───────── */

  listApis(): Api[] {
    const registered = [...this.registered.values()].sort((a, b) => a.registeredAt - b.registeredAt);
    return [...this.official, ...registered];
  }

  getApi(id: string): Api | undefined {
    return this.official.find((a) => a.id === id) ?? this.registered.get(id);
  }

  addApi(api: Api): void {
    this.registered.set(api.id, api);
    this.bus.emit({ type: "api.updated", properties: clone(api) });
    this.save();
  }

  removeApi(id: string): void {
    this.registered.delete(id);
    this.bus.emit({ type: "api.removed", properties: { id } });
    this.save();
  }

  /* ───────── keys ───────── */

  listKeys(): Key[] {
    return [...this.keys.values()].map((k) => clone(k.key)).sort((a, b) => b.createdAt - a.createdAt);
  }

  getKey(id: string): Key | undefined {
    const stored = this.keys.get(id);
    return stored ? clone(stored.key) : undefined;
  }

  getStoredKey(id: string): StoredKey | undefined {
    return this.keys.get(id);
  }

  putKey(stored: StoredKey): Key {
    this.keys.set(stored.key.id, stored);
    this.bus.emit({ type: "key.updated", properties: clone(stored.key) });
    this.save();
    return clone(stored.key);
  }

  /** Records that a key signed a request. */
  touchKey(id: string): void {
    const stored = this.keys.get(id);
    if (!stored) return;
    stored.key.lastUsedAt = this.now();
    stored.key.requests += 1;
    this.putKey(stored);
  }

  /* ───────── sessions ───────── */

  listSessions(): Session[] {
    return [...this.sessions.values()].map(clone).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getSession(id: string): Session | undefined {
    const session = this.sessions.get(id);
    return session ? clone(session) : undefined;
  }

  createSession(title?: string): Session {
    const at = this.now();
    const session: Session = { id: newId("ses"), title: title?.trim() || defaultSessionTitle(at), createdAt: at, updatedAt: at, exchanges: 0 };
    this.sessions.set(session.id, session);
    this.bus.emit({ type: "session.updated", properties: clone(session) });
    this.note(session.id, "session.started", "Session started", null, null);
    this.save();
    return clone(session);
  }

  updateSession(id: string, patch: Partial<Pick<Session, "title" | "exchanges">>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    Object.assign(session, patch, { updatedAt: this.now() });
    this.bus.emit({ type: "session.updated", properties: clone(session) });
    this.save();
    return clone(session);
  }

  removeSession(id: string): boolean {
    if (!this.sessions.delete(id)) return false;
    this.exchanges.delete(id);
    this.activity.delete(id);
    this.bus.emit({ type: "session.removed", properties: { id } });
    this.save();
    return true;
  }

  /* ───────── exchanges and activity ───────── */

  listExchanges(sessionId: string): Exchange[] {
    return (this.exchanges.get(sessionId) ?? []).map(clone);
  }

  /** Adds or replaces an exchange and tells every client. */
  putExchange(exchange: Exchange): void {
    this.pushExchange(exchange);
    this.bus.emit({ type: "exchange.updated", properties: clone(exchange) });
    this.save();
  }

  listActivity(sessionId: string): Activity[] {
    return (this.activity.get(sessionId) ?? []).map(clone);
  }

  /** Writes an activity row into a session. Does nothing when the session is unknown, so callers can pass an optional header. */
  note(sessionId: string | null | undefined, kind: ActivityKind, title: string, detail: string | null, ref: Activity["ref"]): Activity | null {
    if (!sessionId || !this.sessions.has(sessionId)) return null;
    const entry: Activity = { id: newId("act", 10), sessionId, at: this.now(), kind, title, detail, ref };
    this.pushActivity(entry);
    this.bus.emit({ type: "activity.created", properties: clone(entry) });
    this.save();
    return entry;
  }

  /* ───────── preferences ───────── */

  getPreferences(): Preferences {
    return clone(this.preferences);
  }

  setPreferences(next: Preferences): Preferences {
    this.preferences = next;
    this.bus.emit({ type: "preferences.updated", properties: clone(next) });
    this.save();
    return clone(next);
  }

  /* ───────── usage ───────── */

  recordUsage(apiId: string, keyId: string | null, failed: boolean): void {
    const now = this.now();
    const hour = String(Math.floor(now / HOUR) * HOUR);
    const bucket = (this.usage[hour] ??= { apis: {}, keys: {} });
    const counter = (bucket.apis[apiId] ??= { requests: 0, errors: 0 });
    counter.requests += 1;
    if (failed) counter.errors += 1;
    if (keyId) bucket.keys[keyId] = (bucket.keys[keyId] ?? 0) + 1;
    for (const key of Object.keys(this.usage)) if (Number(key) < now - USAGE_RETENTION_MS) delete this.usage[key];
    this.save();
  }

  usageHours(): Record<string, UsageHour> {
    return this.usage;
  }

  /* ───────── persistence ───────── */

  save(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.queueWrite();
    }, SAVE_DELAY_MS);
    this.timer.unref();
  }

  /** Writes any pending change now and waits for it to land. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.queueWrite();
    }
    await this.writing;
  }

  private queueWrite(): void {
    const json = JSON.stringify(this.snapshot());
    this.writing = this.writing
      .then(async () => {
        await mkdir(dirname(this.dataPath), { recursive: true });
        const tmp = `${this.dataPath}.${process.pid}.tmp`;
        await writeFile(tmp, json);
        await rename(tmp, this.dataPath);
      })
      .catch((error: unknown) => {
        console.error("tether: could not write state", error);
      });
  }

  private snapshot(): Persisted {
    return {
      version: 1,
      registered: [...this.registered.values()],
      keys: [...this.keys.values()],
      sessions: [...this.sessions.values()],
      exchanges: [...this.exchanges.values()].flat(),
      activity: [...this.activity.values()].flat(),
      preferences: this.preferences,
      usage: this.usage,
    };
  }

  private pushExchange(exchange: Exchange): void {
    const list = this.exchanges.get(exchange.sessionId) ?? [];
    const at = list.findIndex((e) => e.id === exchange.id);
    if (at >= 0) list[at] = exchange;
    else list.push(exchange);
    if (list.length > MAX_EXCHANGES_PER_SESSION) list.splice(0, list.length - MAX_EXCHANGES_PER_SESSION);
    this.exchanges.set(exchange.sessionId, list);
  }

  private pushActivity(entry: Activity): void {
    const list = this.activity.get(entry.sessionId) ?? [];
    list.push(entry);
    if (list.length > MAX_ACTIVITY_PER_SESSION) list.splice(0, list.length - MAX_ACTIVITY_PER_SESSION);
    this.activity.set(entry.sessionId, list);
  }

  /** An exchange that was mid-flight when the server stopped will never finish; say so instead of leaving it running. */
  private settleInterrupted(exchange: Exchange): Exchange {
    if (exchange.state !== "running") return exchange;
    const open = exchange.phases[exchange.phases.length - 1];
    if (open && open.ms === null) open.ms = Math.max(0, this.now() - open.startedAt);
    exchange.state = "failed";
    exchange.error = { hop: open?.hop ?? "queue", code: "server_restarted", message: "The server restarted before this request finished" };
    exchange.ms = Math.max(0, this.now() - exchange.startedAt);
    return exchange;
  }
}
