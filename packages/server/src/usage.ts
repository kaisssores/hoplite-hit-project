import type { Usage, UsageBucket, UsageRange } from "@tether/contract";
import type { HealthSim } from "./health.ts";
import type { Store } from "./store.ts";
import { clamp, DAY, hashString, HOUR, mulberry32 } from "./util.ts";

const QUOTA_LIMIT = 10_000_000;
/** Requests per day the account makes in a typical week, before the weekly rhythm is applied. */
const DAILY_BASELINE = 237_000;
const WEEKDAY = [0.62, 1.05, 1.1, 1.08, 1.06, 0.98, 0.6];

const RANGES: Record<UsageRange, { size: number; count: number }> = {
  "24h": { size: HOUR, count: 24 },
  "7d": { size: 6 * HOUR, count: 28 },
  "30d": { size: DAY, count: 30 },
};

/** Share of the account's traffic each official API takes. */
const API_SHARE: Record<string, number> = {
  payments: 0.27,
  identity: 0.22,
  ledger: 0.13,
  messaging: 0.09,
  search: 0.07,
  files: 0.06,
  storefront: 0.05,
  geo: 0.04,
  webhooks: 0.035,
  reports: 0.005,
};

/** Share of baseline traffic per seeded key; keys created later only show what they send themselves. */
const KEY_SHARE: Record<string, number> = { key_checkout: 0.64, key_support: 0.23, key_staging: 0.13 };

const FALLBACK_ERROR_RATE = 0.003;

const daylight = (t: number) => 1 + 0.6 * Math.sin((2 * Math.PI * (new Date(t + HOUR / 2).getUTCHours() - 9)) / 24);

/** Deterministic requests for one hour; hours that have not finished count in proportion. */
function baselineHour(t: number, now: number): number {
  const weekday = WEEKDAY[new Date(t).getUTCDay()]!;
  const noise = 1 + (mulberry32(hashString(String(t)))() - 0.5) * 0.12;
  return DAILY_BASELINE * weekday * (daylight(t) / 24) * noise * clamp((now - t) / HOUR, 0, 1);
}

function baselineSpan(start: number, end: number, now: number): number {
  let sum = 0;
  for (let t = start; t < end; t += HOUR) sum += baselineHour(t, now);
  return sum;
}

export function buildUsage(range: UsageRange, store: Store, health: HealthSim, now: number): Usage {
  const { size, count } = RANGES[range];
  const lastStart = Math.floor(now / size) * size;
  const firstStart = lastStart - (count - 1) * size;
  const errorRate = (apiId: string) => health.get(apiId)?.errorRate ?? FALLBACK_ERROR_RATE;
  const weightedError = Object.entries(API_SHARE).reduce((sum, [id, share]) => sum + share * errorRate(id), 0);

  const bucket = (start: number): UsageBucket => {
    const requests = baselineSpan(start, start + size, now);
    return { t: start, requests, errors: requests * weightedError };
  };
  const buckets = Array.from({ length: count }, (_, i) => bucket(firstStart + i * size));
  const previous = Array.from({ length: count }, (_, i) => bucket(firstStart + (i - count) * size));

  const recordedApis: Record<string, { requests: number; errors: number }> = {};
  const recordedKeys: Record<string, number> = {};
  for (const [hour, entry] of Object.entries(store.usageHours())) {
    const t = Number(hour);
    if (t < firstStart || t >= lastStart + size) continue;
    const target = buckets[Math.floor((t - firstStart) / size)]!;
    for (const [apiId, counter] of Object.entries(entry.apis)) {
      target.requests += counter.requests;
      target.errors += counter.errors;
      const sum = (recordedApis[apiId] ??= { requests: 0, errors: 0 });
      sum.requests += counter.requests;
      sum.errors += counter.errors;
    }
    for (const [keyId, n] of Object.entries(entry.keys)) recordedKeys[keyId] = (recordedKeys[keyId] ?? 0) + n;
  }
  for (const b of [...buckets, ...previous]) {
    b.requests = Math.round(b.requests);
    b.errors = Math.round(b.errors);
  }

  const baselineTotal = baselineSpan(firstStart, lastStart + size, now);
  const apiIds = new Set([...Object.keys(API_SHARE), ...Object.keys(recordedApis)]);
  const byApi = [...apiIds]
    .map((apiId) => {
      const share = API_SHARE[apiId] ?? 0;
      const requests = Math.round(baselineTotal * share) + (recordedApis[apiId]?.requests ?? 0);
      const errors = Math.round(baselineTotal * share * errorRate(apiId)) + (recordedApis[apiId]?.errors ?? 0);
      return { apiId, requests, errors, p50: health.get(apiId)?.p50 ?? 0 };
    })
    .filter((row) => row.requests > 0)
    .sort((a, b) => b.requests - a.requests);

  const byKey = store
    .listKeys()
    .filter((key) => key.status === "active")
    .map((key) => ({ keyId: key.id, requests: Math.round(baselineTotal * (KEY_SHARE[key.id] ?? 0)) + (recordedKeys[key.id] ?? 0) }))
    .sort((a, b) => b.requests - a.requests);

  const p50s = byApi.map((row) => row.p50).sort((a, b) => a - b);
  const median = p50s.length === 0 ? 0 : p50s[Math.floor(p50s.length / 2)]!;

  const monthStart = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1);
  let used = baselineSpan(monthStart, now + HOUR, now);
  for (const [hour, entry] of Object.entries(store.usageHours())) {
    if (Number(hour) >= monthStart) used += Object.values(entry.apis).reduce((sum, c) => sum + c.requests, 0);
  }

  return {
    range,
    buckets,
    previous,
    totals: {
      requests: buckets.reduce((sum, b) => sum + b.requests, 0),
      errors: buckets.reduce((sum, b) => sum + b.errors, 0),
      p50: median,
      previousRequests: previous.reduce((sum, b) => sum + b.requests, 0),
    },
    byApi,
    byKey,
    quota: { used: Math.round(used), limit: QUOTA_LIMIT, resetsAt: Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth() + 1, 1) },
  };
}
