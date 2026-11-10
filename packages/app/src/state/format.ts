const int = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const fmtInt = (n: number) => int.format(Math.round(n));
export const fmtCompact = (n: number) => (n < 10_000 ? fmtInt(n) : compact.format(n));
export const fmtMs = (n: number | null | undefined) => (n == null ? "—" : `${fmtInt(n)} ms`);

export function fmtPct(ratio: number, digits = 2): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtBytes(n: number): string {
  if (n < 1000) return `${n} B`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)} kB`;
  return `${(n / 1_000_000).toFixed(1)} MB`;
}

export function fmtClock(t: number, seconds = true): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}${seconds ? `:${p(d.getSeconds())}` : ""}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDay(t: number | string): string {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDayShort(t: number): string {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtAgo(t: number | null, now = Date.now()): string {
  if (t == null) return "Never";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "Just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return fmtDay(t);
}

export function fmtDelta(current: number, previous: number): string {
  if (!previous) return "—";
  const change = (current - previous) / previous;
  const sign = change >= 0 ? "+" : "−";
  return `${sign}${Math.abs(change * 100).toFixed(1)}%`;
}

export const AUTH_LABEL: Record<string, string> = {
  api_key: "API key",
  bearer: "Bearer token",
  hmac: "HMAC signature",
  none: "No auth",
};

export const STATUS_LABEL: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
  maintenance: "Maintenance",
};

export const HOP_LABEL: Record<string, string> = {
  queue: "Queue",
  auth: "Sign",
  upstream: "Upstream",
  transfer: "Return",
};
