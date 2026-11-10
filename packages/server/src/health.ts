import type { ApiHealth, HealthSample, HealthStatus } from "@tether/contract";
import type { Bus } from "./bus.ts";
import { clamp, hashString, mulberry32, MINUTE } from "./util.ts";

const SLOT = 30 * MINUTE;
const SAMPLES = 48;
export const TICK_MS = 2500;

interface Profile {
  status: HealthStatus;
  note: string | null;
  p50: number;
  p95: number;
  errorRate: number;
  uptime: number;
  requests24h: number;
}

const healthy = (p50: number, p95: number, errorRate: number, uptime: number, requests24h: number): Profile => ({
  status: "operational",
  note: null,
  p50,
  p95,
  errorRate,
  uptime,
  requests24h,
});

/** Where each API settles when nothing is wrong with it. */
const PROFILES: Record<string, Profile> = {
  identity: healthy(52, 128, 0.0008, 99.998, 8_400_000),
  payments: healthy(118, 310, 0.0021, 99.994, 3_150_000),
  ledger: healthy(96, 240, 0.0006, 99.999, 1_240_000),
  messaging: { status: "degraded", note: "Elevated latency on SMS delivery", p50: 640, p95: 1900, errorRate: 0.031, uptime: 99.912, requests24h: 780_000 },
  files: healthy(168, 470, 0.0012, 99.981, 410_000),
  search: healthy(74, 190, 0.0019, 99.962, 2_300_000),
  storefront: healthy(142, 365, 0.0014, 99.987, 1_050_000),
  geo: healthy(46, 104, 0.0005, 99.999, 5_900_000),
  reports: { status: "maintenance", note: "Scheduled maintenance until 19:00 UTC", p50: 240, p95: 690, errorRate: 0.0034, uptime: 99.905, requests24h: 41_000 },
  webhooks: healthy(88, 215, 0.0011, 99.989, 620_000),
  hub: healthy(9, 25, 0.0003, 99.999, 1_600),
};

const QUIET: Profile = healthy(60, 150, 0, 100, 0);

/** Quiet daily curve, peaking mid-afternoon UTC, averaging 1 over a day. */
const load = (t: number) => 1 + 0.6 * Math.sin((2 * Math.PI * (new Date(t + SLOT / 2).getUTCHours() - 9)) / 24);

function buildHistory(apiId: string, profile: Profile, now: number): HealthSample[] {
  const lastT = Math.floor(now / SLOT) * SLOT;
  const perSample = profile.requests24h / SAMPLES;
  return Array.from({ length: SAMPLES }, (_, i) => {
    const t = lastT - (SAMPLES - 1 - i) * SLOT;
    const rng = mulberry32(hashString(apiId) ^ (t / SLOT));
    const wave = load(t);
    let latency = 0.92 + 0.1 * wave + (rng() - 0.5) * 0.08;
    let errors = 0.7 + rng() * 0.6;
    let traffic = wave * (1 + (rng() - 0.5) * 0.1);

    if (profile.status === "degraded") {
      const climb = i >= SAMPLES - 6 ? (i - (SAMPLES - 7)) / 6 : 0;
      latency *= 0.55 + 0.45 * climb;
      errors *= 0.4 + 2.1 * climb;
    }
    if (profile.status === "maintenance") traffic *= [1, 0.5, 0.12, 0][clamp(i - (SAMPLES - 4), 0, 3)]!;
    if (i === SAMPLES - 1) traffic *= clamp((now - lastT) / SLOT, 0.05, 1);

    const requests = Math.round(perSample * traffic);
    const p50 = Math.max(1, Math.round(profile.p50 * latency));
    return {
      t,
      p50,
      p95: Math.max(p50 + 1, Math.round(profile.p95 * latency * (1 + rng() * 0.1))),
      requests,
      errors: Math.round(requests * profile.errorRate * errors),
    };
  });
}

function summarise(health: ApiHealth): void {
  const requests = health.history.reduce((sum, s) => sum + s.requests, 0);
  const errors = health.history.reduce((sum, s) => sum + s.errors, 0);
  health.requests24h = requests;
  health.errorRate = requests === 0 ? 0 : Math.round((errors / requests) * 1e5) / 1e5;
}

/** Simulated health for every API. In-memory only: a restart rebuilds the same shape from a seeded PRNG. */
export class HealthSim {
  private records = new Map<string, ApiHealth>();
  private baselines = new Map<string, Profile>();
  private cursor = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private bus: Bus,
    private now: () => number = Date.now,
  ) {}

  ensure(apiId: string): ApiHealth {
    const existing = this.records.get(apiId);
    if (existing) return existing;
    const profile = PROFILES[apiId] ?? QUIET;
    const health: ApiHealth = {
      apiId,
      status: profile.status,
      note: profile.note,
      p50: profile.p50,
      p95: profile.p95,
      errorRate: 0,
      uptime: profile.uptime,
      requests24h: 0,
      history: buildHistory(apiId, profile, this.now()),
    };
    summarise(health);
    this.baselines.set(apiId, profile);
    this.records.set(apiId, health);
    return health;
  }

  get(apiId: string): ApiHealth | undefined {
    return this.records.get(apiId);
  }

  remove(apiId: string): void {
    this.records.delete(apiId);
    this.baselines.delete(apiId);
  }

  list(apiIds: string[]): ApiHealth[] {
    return apiIds.map((id) => {
      const health = this.ensure(id);
      this.roll(health);
      return structuredClone(health);
    });
  }

  /** Counts one real request against an API's current half-hour. */
  record(apiId: string, failed: boolean): void {
    const health = this.ensure(apiId);
    this.roll(health);
    const last = health.history[health.history.length - 1]!;
    last.requests += 1;
    if (failed) last.errors += 1;
    summarise(health);
    this.publish(health);
  }

  tick(): void {
    const ids = [...this.records.keys()];
    if (ids.length === 0) return;
    const health = this.records.get(ids[this.cursor++ % ids.length]!)!;
    const base = this.baselines.get(health.apiId)!;
    this.roll(health);

    // Mean-reverting jitter: each step pulls toward the baseline and adds a little noise.
    health.p50 = Math.max(1, Math.round(health.p50 + (base.p50 - health.p50) * 0.25 + base.p50 * (Math.random() - 0.5) * 0.06));
    health.p95 = Math.max(health.p50 + 1, Math.round(health.p95 + (base.p95 - health.p95) * 0.25 + base.p95 * (Math.random() - 0.5) * 0.08));

    const last = health.history[health.history.length - 1]!;
    last.p50 = health.p50;
    last.p95 = health.p95;
    if (health.status !== "maintenance" && health.status !== "outage") {
      // Roughly the traffic this API sees between two of its own turns in the round robin.
      const added = Math.round((base.requests24h / 86_400) * ((TICK_MS * ids.length) / 1000) * (0.8 + Math.random() * 0.4));
      last.requests += added;
      last.errors += Math.round(added * base.errorRate * (0.7 + Math.random() * 0.6));
    }
    summarise(health);
    this.publish(health);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private roll(health: ApiHealth): void {
    const slot = Math.floor(this.now() / SLOT) * SLOT;
    let last = health.history[health.history.length - 1]!;
    while (last.t < slot) {
      last = { t: last.t + SLOT, p50: health.p50, p95: health.p95, requests: 0, errors: 0 };
      health.history.push(last);
      health.history.shift();
    }
  }

  private publish(health: ApiHealth): void {
    this.bus.emit({ type: "health.updated", properties: structuredClone(health) });
  }
}
