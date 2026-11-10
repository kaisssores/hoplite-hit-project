import { useEffect, useState } from "react";
import type { Api, Exchange, Hop } from "@tether/sdk";
import { HOP_LABEL, fmtMs } from "../state/format";
import { useElapsed, useSize } from "../ui/hooks";

type StrandState = "idle" | "active" | "done" | "snapped";

const OUT: Hop[] = ["queue", "auth", "upstream"];
const TOP = 44;
const BOTTOM = 88;
const EDGE = 52;
const HEIGHT = 132;
/** The shortest time one stretch stays in flight on screen, so a fast server is still readable. */
const DWELL = 160;

/* ───────────── Pacing ───────────── */

/** 0 to 3 is the hop in flight, 4 is finished. */
function stepOf(exchange: Exchange): number {
  return exchange.state === "running" ? Math.max(0, exchange.phases.length - 1) : 4;
}

export interface Paced {
  /** The exchange as far as the screen has played it. */
  exchange: Exchange | null;
  /** The hop drawn in flight, if any. */
  active: Hop | null;
  /** True while the screen is behind the server and catching up. */
  behind: boolean;
}

/**
 * The server reports hops as they happen, sometimes several within one frame.
 * This plays them back one stretch at a time, never faster than DWELL each, so
 * the request is seen travelling. Timings shown are always the server's own.
 * An exchange opened from history is shown finished, without playback.
 */
export function usePaced(exchange: Exchange | null): Paced {
  const id = exchange?.id ?? null;
  const real = exchange ? stepOf(exchange) : 0;
  const [played, setPlayed] = useState({ id, step: real });
  let step = played.step;
  if (played.id !== id) {
    step = exchange?.state === "running" ? 0 : real;
    setPlayed({ id, step });
  }
  const last = exchange ? exchange.phases.length - 1 : 0;

  useEffect(() => {
    if (step >= real) return;
    const timer = setTimeout(
      () => setPlayed((current) => (current.id === id ? { id, step: current.step < last ? current.step + 1 : 4 } : current)),
      DWELL,
    );
    return () => clearTimeout(timer);
  }, [step, real, last, id]);

  if (!exchange) return { exchange: null, active: null, behind: false };
  if (step >= 4) return { exchange, active: null, behind: false };
  const phases = exchange.phases.slice(0, step + 1);
  return {
    exchange: { ...exchange, state: "running", phases, response: null, error: null, ms: null },
    active: phases[phases.length - 1]?.hop ?? null,
    behind: step < real,
  };
}

/* ───────────── Drawing ───────────── */

/** Two half paths per stretch, with the same commands in every state, so `d` can tween between them. */
function strand(x1: number, x2: number, y: number, state: StrandState, sag: number): [string, string] {
  const length = x2 - x1;
  const middle = (x1 + x2) / 2;
  if (state === "snapped") {
    return [
      `M${x1} ${y} Q ${x1 + length * 0.1} ${y + 7} ${x1 + length * 0.16} ${y + 22}`,
      `M${x2} ${y} Q ${x2 - length * 0.1} ${y + 7} ${x2 - length * 0.16} ${y + 22}`,
    ];
  }
  const drop = state === "idle" ? sag : 0;
  return [
    `M${x1} ${y} Q ${(x1 + middle) / 2} ${y + drop} ${middle} ${y + drop}`,
    `M${x2} ${y} Q ${(x2 + middle) / 2} ${y + drop} ${middle} ${y + drop}`,
  ];
}

function stateOf(exchange: Exchange | null, hop: Hop, active: Hop | null): StrandState {
  const phase = exchange?.phases.find((entry) => entry.hop === hop);
  if (!exchange || !phase) return "idle";
  if (exchange.error?.hop === hop) return "snapped";
  if (hop === active) return "active";
  return phase.ms == null ? "idle" : "done";
}

function LiveMs() {
  return <>{fmtMs(useElapsed(true))}</>;
}

function Readout({ x, y, hop, state, exchange }: { x: number; y: number; hop: Hop; state: StrandState; exchange: Exchange | null }) {
  const phase = exchange?.phases.find((entry) => entry.hop === hop);
  let value: React.ReactNode = "—";
  if (state === "snapped") value = exchange?.error?.code.replace(/_/g, " ");
  else if (state === "done" || (state === "active" && phase?.ms != null)) value = fmtMs(phase?.ms);
  else if (state === "active") value = <LiveMs key={exchange?.id} />;
  return (
    <text className="line-readout" data-state={state} x={x} y={y} textAnchor="middle">
      <tspan className="line-hop">{HOP_LABEL[hop]}</tspan>
      <tspan className="line-ms" dx="8">
        {value}
      </tspan>
    </text>
  );
}

/** The knot rides the loop. Its place is one number, the distance travelled, so it can only ever move along the line. */
function Knot({ path, distance, ms, hidden }: { path: string; distance: number; ms: number; hidden: boolean }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAt(distance));
    return () => cancelAnimationFrame(frame);
  }, [distance]);
  return (
    <circle
      className="knot"
      r="5"
      data-hidden={hidden || undefined}
      style={{ offsetPath: `path("${path}")`, offsetDistance: `${at}px`, transitionDuration: `${ms}ms, 200ms` }}
    />
  );
}

/**
 * The request's path, drawn as one line looped around four posts. The request
 * goes out along the top strand, hop by hop, and the response comes back along
 * the bottom. A stretch is slack until it is in flight, taut while it carries
 * the request, and snapped where the request was lost.
 */
export function RequestLine({ paced, api, adapterLabel }: { paced: Paced; api: Api; adapterLabel: string }) {
  const { exchange, active, behind } = paced;
  const [ref, { width }] = useSize<HTMLDivElement>();
  const xs = [0, 1, 2, 3].map((index) => EDGE + (index * Math.max(0, width - EDGE * 2)) / 3);
  const states = OUT.map((hop) => stateOf(exchange, hop, active));
  const back = stateOf(exchange, "transfer", active);
  const upstream = api.adapter === "loopback" ? "This server" : new URL(api.baseUrl).host;
  const labels = ["You", "Tether", adapterLabel, upstream];

  const span = xs[3]! - xs[0]!;
  const turn = BOTTOM - TOP;
  const loop = `M${xs[0]} ${TOP} L${xs[3]} ${TOP} L${xs[3]} ${BOTTOM} L${xs[0]} ${BOTTOM}`;
  const reach = behind ? 1 : 0.9;
  let knot = { distance: 0, ms: 0, hidden: true };
  if (active) {
    const index = OUT.indexOf(active);
    if (index >= 0) {
      const stretch = xs[index + 1]! - xs[index]!;
      knot = { distance: xs[index]! - xs[0]! + stretch * reach, ms: behind ? DWELL : [320, 420, 1400][index]!, hidden: false };
    } else {
      knot = { distance: span + turn + span * reach, ms: behind ? DWELL + 80 : 640, hidden: false };
    }
  } else if (exchange?.state === "done") {
    knot = { distance: span * 2 + turn, ms: 200, hidden: true };
  }

  const summary = !exchange
    ? "No request in flight"
    : exchange.state === "running"
      ? `In flight: ${HOP_LABEL[active ?? "queue"]}`
      : exchange.state === "failed"
        ? `Lost at ${HOP_LABEL[exchange.error?.hop ?? "upstream"]}: ${exchange.error?.message}`
        : `Answered ${exchange.response?.status} in ${fmtMs(exchange.ms)}`;

  return (
    <div className="line" ref={ref} data-state={exchange?.state ?? "idle"}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} aria-hidden="true">
          {labels.map((label, index) => (
            <text key={index} className="line-label" x={xs[index]! + (index === 0 ? -4 : index === 3 ? 4 : 0)} y={20} textAnchor={index === 0 ? "start" : index === 3 ? "end" : "middle"}>
              {label}
            </text>
          ))}
          {strand(xs[3]!, xs[0]!, BOTTOM, back, 9).map((d, half) => (
            <g key={half}>
              <path className="strand-haze" data-state={back} style={{ d: `path("${d}")` }} />
              <path className="strand" data-state={back} style={{ d: `path("${d}")` }} />
            </g>
          ))}
          {OUT.map((hop, index) =>
            strand(xs[index]!, xs[index + 1]!, TOP, states[index]!, 8).map((d, half) => (
              <g key={`${hop}-${half}`}>
                <path className="strand-haze" data-state={states[index]} style={{ d: `path("${d}")` }} />
                <path className="strand" data-state={states[index]} style={{ d: `path("${d}")` }} />
              </g>
            )),
          )}
          {xs.map((x, index) => (
            <rect key={index} className="post" x={x - 4} y={TOP - 8} width={8} height={BOTTOM - TOP + 16} rx={4} />
          ))}
          {OUT.map((hop, index) => (
            <Readout key={hop} hop={hop} state={states[index]!} exchange={exchange} x={(xs[index]! + xs[index + 1]!) / 2} y={(TOP + BOTTOM) / 2 + 6} />
          ))}
          <Readout hop="transfer" state={back} exchange={exchange} x={(xs[0]! + xs[3]!) / 2} y={BOTTOM + 28} />
          <Knot key={exchange?.id ?? "none"} path={loop} {...knot} />
        </svg>
      )}
      <p className="sr-only" role="status">
        {summary}
      </p>
    </div>
  );
}
