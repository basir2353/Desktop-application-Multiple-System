import { useEffect, useState, type ReactNode } from "react";

export const CHART_W = 640;
export const CHART_H = 200;
export const CHART_PAD = { top: 20, right: 12, bottom: 32, left: 44 };

export function useChartAnimate(deps: unknown): boolean {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(false);
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [deps]);
  return animate;
}

type ChartCardProps = {
  title: string;
  subtitle: string;
  summaryLabel?: string;
  summaryValue?: string;
  glowClass: string;
  animateGlow?: boolean;
  children: ReactNode;
};

export function ChartCard({
  title,
  subtitle,
  summaryLabel,
  summaryValue,
  glowClass,
  animateGlow = true,
  children,
}: ChartCardProps): JSX.Element {
  return (
    <div data-ui="dashboard-card" className="relative overflow-hidden rounded-xl p-4">
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl ${glowClass} ${animateGlow ? "chart-glow-animate" : ""}`}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="dashboard-card-title">{title}</h3>
          <p className="dashboard-card-subtitle">{subtitle}</p>
        </div>
        {summaryValue ? (
          <div className="text-right">
            {summaryLabel ? <div className="dashboard-card-label">{summaryLabel}</div> : null}
            <div className="dashboard-card-value">{summaryValue}</div>
          </div>
        ) : null}
      </div>
      <div className="relative mt-3">{children}</div>
      <ChartGlowStyles />
    </div>
  );
}

export function ChartGlowStyles(): JSX.Element {
  return (
    <style>{`
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.25; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.06); }
      }
      .chart-glow-animate { animation: pulse-glow 4s ease-in-out infinite; }
    `}</style>
  );
}
