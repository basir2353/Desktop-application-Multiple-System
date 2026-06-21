import type { Bill } from "@platform/contracts";
import { useEffect, useMemo, useState } from "react";
import type { BusinessDaySettings } from "../lib/businessDay";
import { DEFAULT_BUSINESS_DAY } from "../lib/businessDay";
import { salesTrendFromOrders } from "../lib/orderSales";

function formatPkrShort(amount: number): string {
  if (amount >= 100_000) return `Rs ${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `Rs ${(amount / 1_000).toFixed(1)}k`;
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

type Props = {
  orders: Bill[];
  businessDay?: BusinessDaySettings;
};

const W = 640;
const H = 220;
const PAD = { top: 24, right: 16, bottom: 36, left: 52 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

export function SalesTrendChart({ orders, businessDay = DEFAULT_BUSINESS_DAY }: Props): JSX.Element {
  const points = useMemo(() => salesTrendFromOrders(orders, 7, businessDay), [orders, businessDay]);
  const [animate, setAnimate] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    setAnimate(false);
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [points]);

  const maxAmount = Math.max(...points.map((p) => p.amount), 1);
  const totalWeek = points.reduce((s, p) => s + p.amount, 0);

  const coords = points.map((p, i) => {
    const x = PAD.left + (points.length <= 1 ? INNER_W / 2 : (i / (points.length - 1)) * INNER_W);
    const y = PAD.top + INNER_H - (p.amount / maxAmount) * INNER_H;
    return { ...p, x, y };
  });

  const linePath =
    coords.length > 0
      ? coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ")
      : "";

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${PAD.top + INNER_H} L ${coords[0].x.toFixed(1)} ${PAD.top + INNER_H} Z`
      : "";

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = PAD.top + INNER_H * (1 - t);
    const value = Math.round(maxAmount * t);
    return { y, value };
  });

  return (
    <div data-ui="dashboard-card" className="relative overflow-hidden rounded-xl p-4">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-500/15 opacity-40 blur-3xl"
        style={{ animation: animate ? "pulse-glow 4s ease-in-out infinite" : "none" }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="dashboard-card-title">Sales trend</h2>
          <p className="dashboard-card-subtitle">POS → Orders (completed bills) · last 7 days</p>
        </div>
        <div className="text-right">
          <div className="dashboard-card-label">Week total</div>
          <div
            className="dashboard-accent-amber text-lg font-semibold transition-all duration-700"
            style={{ opacity: animate ? 1 : 0, transform: animate ? "translateY(0)" : "translateY(6px)" }}
          >
            {formatPkrShort(totalWeek)}
          </div>
        </div>
      </div>

      <div className="relative mt-4 w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="Sales trend for the last seven days"
        >
          <defs>
            <linearGradient id="salesAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(245 158 11)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(245 158 11)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="salesLineStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgb(251 191 36)" />
              <stop offset="100%" stopColor="rgb(245 158 11)" />
            </linearGradient>
          </defs>

          {gridLines.map((g) => (
            <g key={g.y}>
              <line
                x1={PAD.left}
                y1={g.y}
                x2={W - PAD.right}
                y2={g.y}
                className="dashboard-chart-grid"
                strokeWidth="1"
                strokeDasharray="4 6"
                opacity={0.6}
              />
              <text x={PAD.left - 8} y={g.y + 4} textAnchor="end" className="dashboard-chart-muted text-[10px]">
                {g.value >= 1000 ? `${Math.round(g.value / 1000)}k` : g.value}
              </text>
            </g>
          ))}

          {areaPath ? (
            <path
              d={areaPath}
              fill="url(#salesAreaFill)"
              style={{
                opacity: animate ? 1 : 0,
                transition: "opacity 0.9s ease-out",
              }}
            />
          ) : null}

          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke="url(#salesLineStroke)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 1200,
                strokeDashoffset: animate ? 0 : 1200,
                transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          ) : null}

          {coords.map((c, i) => (
            <g
              key={c.dateKey}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <line
                x1={c.x}
                y1={PAD.top + INNER_H}
                x2={c.x}
                y2={c.y}
                stroke="rgb(245 158 11)"
                strokeWidth={hovered === i ? 2 : 1}
                opacity={hovered === i ? 0.4 : 0.12}
                style={{
                  transformOrigin: `${c.x}px ${PAD.top + INNER_H}px`,
                  transform: animate ? "scaleY(1)" : "scaleY(0)",
                  transition: `transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.08}s`,
                }}
              />
              <circle
                cx={c.x}
                cy={c.y}
                r={hovered === i ? 6 : 4}
                fill={hovered === i ? "rgb(251 191 36)" : undefined}
                className={hovered === i ? undefined : "dashboard-chart-dot"}
                stroke="rgb(245 158 11)"
                strokeWidth="2"
                style={{
                  opacity: animate ? 1 : 0,
                  transform: animate ? "scale(1)" : "scale(0)",
                  transformOrigin: `${c.x}px ${c.y}px`,
                  transition: `opacity 0.4s ease ${0.5 + i * 0.06}s, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.5 + i * 0.06}s`,
                }}
              />
              <text x={c.x} y={H - 10} textAnchor="middle" className="dashboard-chart-muted text-[10px]">
                {c.label}
              </text>
            </g>
          ))}
        </svg>

        {hovered !== null && coords[hovered] ? (
          <div
            className="dashboard-chart-tooltip pointer-events-none absolute z-10"
            style={{
              left: `${(coords[hovered].x / W) * 100}%`,
              top: `${(coords[hovered].y / H) * 100}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div className="dashboard-accent-amber font-medium">{formatPkrShort(coords[hovered].amount)}</div>
            <div className="dashboard-card-label">{coords[hovered].label}</div>
          </div>
        ) : null}

        {totalWeek === 0 ? (
          <p className="dashboard-chart-empty absolute inset-0 flex items-center justify-center">
            Complete orders via POS Pay to see the trend.
          </p>
        ) : null}
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
