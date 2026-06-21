import type { ChartSegment } from "../../lib/orderSales";
import { useChartAnimate } from "./chartShared";

type Props = {
  segments: ChartSegment[];
  formatValue?: (n: number) => string;
  emptyMessage?: string;
};

const R = 62;
const CX = 100;
const CY = 100;
const C = 2 * Math.PI * R;

export function AnimatedDonutChart({
  segments,
  formatValue = (n) => String(n),
  emptyMessage = "No data yet",
}: Props): JSX.Element {
  const animate = useChartAnimate(segments);
  const total = segments.reduce((s, x) => s + x.value, 0);

  let offset = 0;
  const arcs = segments.map((seg) => {
    const frac = total > 0 ? seg.value / total : 0;
    const len = frac * C;
    const dash = `${len} ${C - len}`;
    const dashOffset = -offset;
    offset += len;
    return { ...seg, dash, dashOffset, frac };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
      <div className="relative shrink-0">
        <svg width={200} height={200} viewBox="0 0 200 200" role="img">
          <circle cx={CX} cy={CY} r={R} fill="none" className="dashboard-donut-track" strokeWidth="14" />
          {arcs.map((a, i) => (
            <circle
              key={a.label}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={a.dash}
              strokeDashoffset={animate ? a.dashOffset : C}
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{
                transition: `stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.12}s`,
              }}
            />
          ))}
          <text x={CX} y={CY - 4} textAnchor="middle" className="dashboard-donut-center text-lg font-semibold">
            {total > 0 ? formatValue(total) : "—"}
          </text>
          <text x={CX} y={CY + 14} textAnchor="middle" className="dashboard-chart-muted text-[10px]">
            total
          </text>
        </svg>
        {total === 0 ? (
          <p className="dashboard-chart-empty absolute inset-0 flex items-center justify-center px-4 text-center text-xs">
            {emptyMessage}
          </p>
        ) : null}
      </div>
      <ul className="space-y-2 text-sm">
        {segments.map((s, i) => (
          <li
            key={s.label}
            className="flex items-center gap-2"
            style={{
              opacity: animate ? 1 : 0,
              transform: animate ? "translateX(0)" : "translateX(-8px)",
              transition: `opacity 0.5s ease ${0.3 + i * 0.08}s, transform 0.5s ease ${0.3 + i * 0.08}s`,
            }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="dashboard-legend-label">{s.label}</span>
            <span className="dashboard-legend-value ml-auto">{formatValue(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
