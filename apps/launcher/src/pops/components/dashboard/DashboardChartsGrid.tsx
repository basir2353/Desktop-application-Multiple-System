import type { Bill, DashboardMetrics, KitchenTicket } from "@platform/contracts";
import { useMemo } from "react";
import type { BusinessDaySettings } from "../../lib/businessDay";
import { DEFAULT_BUSINESS_DAY } from "../../lib/businessDay";
import {
  pendingOrdersStatusBars,
  summarizePendingOrders,
} from "../../lib/pendingOrdersMetrics";
import { channelSalesFromOrders, orderVolumeTrendFromOrders, salesTrendFromOrders } from "../../lib/orderSales";
import { SalesTrendChart } from "../SalesTrendChart";
import { AnimatedBarChart } from "./AnimatedBarChart";
import { AnimatedDonutChart } from "./AnimatedDonutChart";
import { ChartCard } from "./chartShared";

function formatPkrShort(amount: number): string {
  if (amount >= 100_000) return `Rs ${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `Rs ${(amount / 1_000).toFixed(1)}k`;
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

type Props = {
  /** Same completed bills as POS → Orders (not dashboard API or seed sales). */
  completedOrders: Bill[];
  metrics: DashboardMetrics;
  pendingTickets: KitchenTicket[];
  businessDay?: BusinessDaySettings;
};

export function DashboardChartsGrid({
  completedOrders,
  metrics,
  pendingTickets,
  businessDay = DEFAULT_BUSINESS_DAY,
}: Props): JSX.Element {
  const pendingSummary = useMemo(() => summarizePendingOrders(pendingTickets), [pendingTickets]);
  const channelSegments = useMemo(() => channelSalesFromOrders(completedOrders), [completedOrders]);
  const volumePoints = useMemo(() => {
    return orderVolumeTrendFromOrders(completedOrders, 7, businessDay).map((p) => ({
      label: p.label,
      value: p.amount,
      color: "rgb(56 189 248)",
    }));
  }, [completedOrders, businessDay]);

  const activeBars = useMemo(() => pendingOrdersStatusBars(pendingTickets), [pendingTickets]);

  const opsBars = useMemo(
    () => [
      { label: "Pending", value: pendingSummary.total, color: "rgb(251 191 36)" },
      { label: "Priority", value: pendingSummary.priorityCount, color: "rgb(248 113 113)" },
      { label: "Low stock", value: metrics.lowStock.skuCount, color: "rgb(251 146 60)" },
      { label: "Critical", value: metrics.lowStock.criticalCount, color: "rgb(239 68 68)" },
    ],
    [pendingSummary, metrics.lowStock],
  );

  const weekSales = salesTrendFromOrders(completedOrders, 7, businessDay).reduce((s, p) => s + p.amount, 0);
  const weekOrders = volumePoints.reduce((s, p) => s + p.value, 0);

  return (
    <section className="space-y-4">
      <h2 className="dashboard-section-title">Insights</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <SalesTrendChart orders={completedOrders} businessDay={businessDay} />

        <ChartCard
          title="Sales by channel"
          subtitle="Revenue from POS → Orders (completed bills)"
          summaryLabel="Channels"
          summaryValue={String(channelSegments.filter((s) => s.value > 0).length)}
          glowClass="bg-emerald-500/15"
        >
          <AnimatedDonutChart
            segments={channelSegments}
            formatValue={formatPkrShort}
            emptyMessage="Pay orders to see channel split"
          />
        </ChartCard>

        <ChartCard
          title="Order volume"
          subtitle="Order count from POS → Orders · 7 days"
          summaryLabel="This week"
          summaryValue={`${weekOrders} orders`}
          glowClass="bg-sky-500/15"
        >
          <AnimatedBarChart
            chartId="volume"
            points={volumePoints}
            formatValue={(n) => `${n} orders`}
            emptyMessage="No completed orders this week"
          />
        </ChartCard>

        <ChartCard
          title="Active orders"
          subtitle="Open tickets from Pending orders (POS → Create order)"
          summaryLabel="In kitchen"
          summaryValue={String(pendingSummary.total)}
          glowClass="bg-violet-500/15"
        >
          <AnimatedBarChart
            chartId="active"
            points={activeBars}
            formatValue={(n) => `${n} orders`}
            emptyMessage="No open orders — create one from POS"
          />
        </ChartCard>

        <ChartCard
          title="Kitchen & inventory"
          subtitle="Pending queue and stock alerts"
          summaryLabel="SLA"
          summaryValue={pendingSummary.slaStatus.toUpperCase()}
          glowClass="bg-rose-500/15"
        >
          <AnimatedBarChart
            chartId="ops"
            points={opsBars}
            formatValue={(n) => String(n)}
            emptyMessage="All clear"
          />
        </ChartCard>

        <ChartCard
          title="Sales snapshot"
          subtitle="Week revenue from completed Orders only"
          summaryLabel="Week sales"
          summaryValue={formatPkrShort(weekSales)}
          glowClass="bg-amber-500/10"
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Week revenue", value: formatPkrShort(weekSales), accent: "dashboard-accent-amber" },
              { label: "Week orders", value: String(weekOrders), accent: "dashboard-accent-sky" },
              { label: "Active now", value: String(pendingSummary.total), accent: "dashboard-accent-violet" },
              { label: "Pending KOT", value: String(pendingSummary.total), accent: "dashboard-accent-rose" },
            ].map((item, i) => (
              <div
                key={item.label}
                className="dashboard-mini-stat"
                style={{
                  opacity: 1,
                  animation: `fade-up 0.6s ease ${i * 0.1}s both`,
                }}
              >
                <div className="dashboard-mini-label">{item.label}</div>
                <div className={`mt-1 text-lg font-semibold ${item.accent}`}>{item.value}</div>
              </div>
            ))}
          </div>
          <style>{`
            @keyframes fade-up {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </ChartCard>
      </div>
    </section>
  );
}
