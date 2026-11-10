import type { ConnectionState, HealthStatus } from "@tether/sdk";

/**
 * The tether line is the product's one signature: state is shown as tension.
 * Taut means connected and carrying load, slack means it is holding but
 * sagging, snapped means nothing gets through.
 */
export type Tension = "taut" | "slack" | "snapped" | "moored";

export function tensionOf(status: HealthStatus | undefined): Tension {
  if (status === "degraded") return "slack";
  if (status === "outage") return "snapped";
  if (status === "maintenance") return "moored";
  return "taut";
}

export function tensionOfConnection(conn: ConnectionState): Tension {
  return conn === "open" ? "taut" : conn === "connecting" ? "slack" : "snapped";
}

// Both halves keep the same commands in every state, so the browser can tween `d`.
const SHAPES: Record<Tension, [string, string]> = {
  taut: ["M3 7 Q 8.5 7 14 7", "M25 7 Q 19.5 7 14 7"],
  moored: ["M3 7 Q 8.5 7 14 7", "M25 7 Q 19.5 7 14 7"],
  slack: ["M3 7 Q 8 11.5 14 11.5", "M25 7 Q 20 11.5 14 11.5"],
  snapped: ["M3 7 Q 5 10 8 12.5", "M25 7 Q 23 10 20 12.5"],
};

export function TensionGlyph({ tension, className = "" }: { tension: Tension; className?: string }) {
  const [left, right] = SHAPES[tension];
  return (
    <svg className={`tension ${className}`} data-tension={tension} width="28" height="16" viewBox="0 0 28 16" aria-hidden="true">
      <path className="tension-line" style={{ d: `path("${left}")` }} />
      <path className="tension-line" style={{ d: `path("${right}")` }} />
      <circle className="tension-end" cx="3" cy="7" r="2" />
      <circle className="tension-end" cx="25" cy="7" r="2" />
    </svg>
  );
}

