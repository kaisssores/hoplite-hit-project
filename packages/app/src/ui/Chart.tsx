import { useMemo, useState, type ReactNode } from "react";
import { useSize } from "./hooks";

export interface ChartLine {
  id: string;
  label: string;
  values: number[];
  /** `lead` takes the accent. Everything else stays in the neutral ramp. */
  tone: "lead" | "quiet";
  dashed?: boolean;
}

interface ChartProps {
  times: number[];
  lines: ChartLine[];
  /** A filled band between two series, like p50 to p95. */
  band?: { label: string; low: number[]; high: number[] };
  /** Thin bars standing on the baseline, on their own scale. */
  bars?: { label: string; values: number[] };
  height?: number;
  formatY: (value: number) => string;
  formatX: (time: number) => string;
  /** Extra rows for the readout at the hovered point. */
  readout?: (index: number) => { label: string; value: string }[];
  xTicks?: number;
}

const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const unit = value / power;
  const step = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 4 ? 4 : unit <= 5 ? 5 : unit <= 8 ? 8 : 10;
  return step * power;
}

/** A smooth path through the points. Tangents are clamped so the curve never overshoots the data. */
function smooth(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    const c1y = Math.min(hi, Math.max(lo, p1[1] + (p2[1] - p0[1]) / 6));
    const c2y = Math.min(hi, Math.max(lo, p2[1] - (p3[1] - p1[1]) / 6));
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${c1y} ${p2[0] - (p3[0] - p1[0]) / 6} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/**
 * The one chart in the product, drawn like a tide table: hairline grid, mono
 * labels, one line in the accent and everything else in neutral steps.
 */
export function Chart({ times, lines, band, bars, height = 280, formatY, formatX, readout, xTicks = 6 }: ChartProps) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const count = times.length;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;

  const max = useMemo(() => {
    const all = [...lines.flatMap((line) => line.values), ...(band?.high ?? [])];
    return niceMax(Math.max(1, ...all));
  }, [lines, band]);

  const x = (index: number) => PAD.left + (count <= 1 ? 0 : (index / (count - 1)) * innerW);
  const y = (value: number) => PAD.top + innerH - (value / max) * innerH;
  const pointsOf = (values: number[]) => values.map((value, index) => [x(index), y(value)] as [number, number]);

  const bandPath = useMemo(() => {
    if (!band || !innerW) return "";
    const top = smooth(pointsOf(band.high));
    const bottom = smooth(pointsOf(band.low).reverse());
    return `${top} L${bottom.slice(1)} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band, innerW, max, height]);

  const barMax = bars ? Math.max(1, ...bars.values) : 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max);
  const step = Math.max(1, Math.round(count / xTicks));
  const labelIndexes = times.map((_, index) => index).filter((index) => index % step === 0);

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - PAD.left) / Math.max(1, innerW);
    setHover(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))));
  };

  const rows: { label: string; value: string; tone?: string }[] =
    hover == null
      ? []
      : [
          ...lines.map((line) => ({ label: line.label, value: formatY(line.values[hover] ?? 0), tone: line.tone })),
          ...(band ? [{ label: band.label, value: formatY(band.high[hover] ?? 0) }] : []),
          ...(bars ? [{ label: bars.label, value: String(bars.values[hover] ?? 0) }] : []),
          ...(readout?.(hover) ?? []),
        ];
  const flip = hover != null && x(hover) > width - 200;

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img">
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
              <text className="chart-label" x={PAD.left - 12} y={y(tick) + 4} textAnchor="end">
                {formatY(tick)}
              </text>
            </g>
          ))}
          {labelIndexes.map((index) => (
            <text key={index} className="chart-label" x={x(index)} y={height - 8} textAnchor={index === 0 ? "start" : "middle"}>
              {formatX(times[index]!)}
            </text>
          ))}
          {band && <path className="chart-band" d={bandPath} />}
          {bars?.values.map((value, index) =>
            value > 0 ? (
              <rect
                key={index}
                className="chart-bar"
                x={x(index) - 1.5}
                width={3}
                y={PAD.top + innerH - (value / barMax) * innerH * 0.22}
                height={(value / barMax) * innerH * 0.22}
              />
            ) : null,
          )}
          {lines.map((line) => (
            <path
              key={line.id}
              className="chart-line"
              data-tone={line.tone}
              data-dashed={line.dashed || undefined}
              pathLength={line.dashed ? undefined : 1}
              d={smooth(pointsOf(line.values))}
            />
          ))}
          {hover != null && (
            <g>
              <line className="chart-cursor" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} />
              {lines.map((line) => (
                <circle key={line.id} className="chart-dot" data-tone={line.tone} cx={x(hover)} cy={y(line.values[hover] ?? 0)} r={3.5} />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover != null && (
        <div className="chart-readout" style={flip ? { right: width - x(hover) + 12 } : { left: x(hover) + 12 }}>
          <div className="chart-readout-time">{formatX(times[hover]!)}</div>
          {rows.map((row) => (
            <div className="chart-readout-row" key={row.label} data-tone={row.tone}>
              <span>{row.label}</span>
              <span className="num">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A ranked list with thin bars: the second data block next to a chart, different in kind. */
export function Ranked({
  rows,
}: {
  rows: { id: string; label: ReactNode; value: number; text: string; note?: ReactNode; lead?: boolean; onClick?: () => void }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="ranked">
      {rows.map((row) => {
        const body = (
          <>
            <span className="ranked-label">{row.label}</span>
            {row.note && <span className="ranked-note">{row.note}</span>}
            <span className="ranked-value num">{row.text}</span>
            <span className="ranked-track">
              <span className="ranked-bar" data-lead={row.lead || undefined} style={{ transform: `scaleX(${row.value / max})` }} />
            </span>
          </>
        );
        return (
          <li key={row.id}>
            {row.onClick ? (
              <button type="button" className="ranked-row" onClick={row.onClick}>
                {body}
              </button>
            ) : (
              <div className="ranked-row">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
