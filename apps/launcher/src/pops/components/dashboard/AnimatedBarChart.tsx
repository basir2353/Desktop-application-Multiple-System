import { useState } from "react";
import { CHART_H, CHART_PAD, CHART_W, useChartAnimate } from "./chartShared";

type BarPoint = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  points: BarPoint[];
  formatValue?: (n: number) => string;
  emptyMessage?: string;
  chartId: string;
};

export function AnimatedBarChart({
  points,
  formatValue = (n) => String(n),
  emptyMessage = "No data yet",
  chartId,
}: Props): JSX.Element {
  const animate = useChartAnimate(points);
  const [hovered, setHovered] = useState<number | null>(null);

  const innerW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const max = Math.max(...points.map((p) => p.value), 1);
  const barW = Math.min(48, innerW / Math.max(points.length, 1) - 8);
  const gap = (innerW - barW * points.length) / Math.max(points.length + 1, 1);

  const bars = points.map((p, i) => {
    const h = (p.value / max) * innerH;
    const x = CHART_PAD.left + gap + i * (barW + gap);
    const y = CHART_PAD.top + innerH - h;
    return { ...p, x, y, h, i };
  });

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-auto w-full" role="img">
        {[0, 0.5, 1].map((t) => {
          const y = CHART_PAD.top + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={CHART_PAD.left}
              y1={y}
              x2={CHART_W - CHART_PAD.right}
              y2={y}
              className="dashboard-chart-grid"
              strokeDasharray="4 6"
              opacity={0.55}
            />
          );
        })}
        {bars.map((b) => (
          <g
            key={`${chartId}-${b.label}`}
            onMouseEnter={() => setHovered(b.i)}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x={b.x}
              y={b.y}
              width={barW}
              height={b.h}
              rx={4}
              fill={b.color}
              opacity={hovered === null || hovered === b.i ? 0.9 : 0.45}
              style={{
                transformOrigin: `${b.x + barW / 2}px ${CHART_PAD.top + innerH}px`,
                transform: animate ? "scaleY(1)" : "scaleY(0)",
                transition: `transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) ${b.i * 0.07}s`,
              }}
            />
            <text
              x={b.x + barW / 2}
              y={CHART_H - 8}
              textAnchor="middle"
              className="dashboard-chart-muted text-[10px]"
            >
              {b.label}
            </text>
          </g>
        ))}
      </svg>
      {hovered !== null && bars[hovered] ? (
        <div
          className="dashboard-chart-tooltip pointer-events-none absolute z-10"
          style={{
            left: `${((bars[hovered].x + barW / 2) / CHART_W) * 100}%`,
            top: `${(bars[hovered].y / CHART_H) * 100}%`,
            transform: "translate(-50%, -110%)",
          }}
        >
          <span className="dashboard-card-value font-medium">{formatValue(bars[hovered].value)}</span>
        </div>
      ) : null}
      {points.every((p) => p.value === 0) ? (
        <p className="dashboard-chart-empty absolute inset-0 flex items-center justify-center">{emptyMessage}</p>
      ) : null}
    </div>
  );
}
