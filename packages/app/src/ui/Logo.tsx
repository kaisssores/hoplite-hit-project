import type { ConnectionState } from "@tether/sdk";
import { tensionOfConnection, type Tension } from "./Line";

/*
 * The mark is a T made of the product's own idea: a post with a line drawn
 * over it, fixed at both ends. The line shows the connection to the server:
 * taut when the event stream is open, sagging while it is being reached,
 * fallen off the post when it is lost.
 */

// Each half runs from its anchor to the post, with the same commands in every state, so `d` can tween.
const HALVES: Record<Tension, [string, string]> = {
  taut: ["M5 10 Q 10.5 10 16 10", "M27 10 Q 21.5 10 16 10"],
  moored: ["M5 10 Q 10.5 10 16 10", "M27 10 Q 21.5 10 16 10"],
  slack: ["M5 10 Q 10.5 15 16 10", "M27 10 Q 21.5 15 16 10"],
  snapped: ["M5 10 Q 6.5 15 8 20", "M27 10 Q 25.5 15 24 20"],
};

export function LogoMark({
  tension,
  size = 24,
  intro = false,
  className = "",
}: {
  tension: Tension;
  size?: number;
  /** Plays the build-up: post rises, anchors set, the line is drawn from both ends to the post. */
  intro?: boolean;
  className?: string;
}) {
  const [left, right] = HALVES[tension];
  return (
    <svg
      className={`logo ${className}`}
      data-tension={tension}
      data-intro={intro || undefined}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <circle className="logo-haze" cx="16" cy="10" r="10" />
      <rect className="logo-post" x="13.5" y="9" width="5" height="19" rx="2.5" />
      <path className="logo-line" pathLength={1} style={{ d: `path("${left}")` }} />
      <path className="logo-line" pathLength={1} style={{ d: `path("${right}")` }} />
      <circle className="logo-anchor" cx="5" cy="10" r="2.75" />
      <circle className="logo-anchor" cx="27" cy="10" r="2.75" />
    </svg>
  );
}

/** The mark and the wordmark, as the rail shows them. The mark carries the live connection. */
export function Logo({ conn, size = 24 }: { conn: ConnectionState; size?: number }) {
  return (
    <span className="brand-lockup">
      <LogoMark tension={tensionOfConnection(conn)} size={size} className="brand-mark" />
      <span className="brand-word">Tether</span>
    </span>
  );
}
