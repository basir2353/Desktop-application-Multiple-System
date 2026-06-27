import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatedBarChart } from "../../pops/components/dashboard/AnimatedBarChart";
import { AnimatedDonutChart } from "../../pops/components/dashboard/AnimatedDonutChart";
import { PageHeader } from "../../pops/ui/PageHeader";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass } from "../../pops/lib/themeClasses";
import { fetchPharmacyDashboard } from "../api/pharmacy";
import { formatPkr, usePharmacyAccess } from "../hooks/usePharmacy";
import { PharmacyStatCard } from "../ui/PharmacyUi";

const CHART_COLORS = ["#10b981", "#14b8a6", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444"];

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function PharmacyDashboardPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const dashboardQuery = useQuery({
    queryKey: ["pharmacy", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 30_000,
    queryFn: () => fetchPharmacyDashboard(branch!.code),
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
        Loading pharmacy dashboard…
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return <div className={noticeErrorClass}>{(dashboardQuery.error as Error).message}</div>;
  }

  const m = dashboardQuery.data!;
  const isProfit = m.profitMonth >= 0;

  const paymentSegments = m.paymentBreakdown.map((p, i) => ({
    label: p.label,
    value: p.value,
    color: CHART_COLORS[i % CHART_COLORS.length]!,
  }));

  const stockSegments = m.stockHealth.map((s, i) => ({
    label: s.label,
    value: s.value,
    color: i === 0 ? "#10b981" : i === 1 ? "#f59e0b" : "#ef4444",
  }));

  const rxSegments = m.prescriptionBreakdown.map((r, i) => ({
    label: r.label,
    value: r.value,
    color: CHART_COLORS[i % CHART_COLORS.length]!,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmacy dashboard"
        subtitle={`Overview for ${branch?.name ?? "branch"} — sales, stock, prescriptions, and alerts at a glance.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pops/pharmacy/pos"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              Quick billing
            </Link>
            <Link
              to="/pops/pharmacy/prescriptions"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Prescriptions
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Sales today" value={formatPkr(m.totalSalesToday)} tone="success" />
        <PharmacyStatCard label="Revenue (month)" value={formatPkr(m.revenueMonth)} />
        <PharmacyStatCard label="Profit (month)" value={formatPkr(m.profitMonth)} tone={isProfit ? "success" : "danger"} />
        <PharmacyStatCard label="Bills today" value={m.transactionCountToday} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Stock on hand" value={m.availableStock.toLocaleString()} />
        <PharmacyStatCard label="Low stock items" value={m.lowStockCount} tone="warning" />
        <PharmacyStatCard label="Expiring soon" value={m.expiringCount} tone="warning" />
        <PharmacyStatCard label="Pending Rx" value={m.pendingOrders} tone={m.pendingOrders > 0 ? "warning" : "default"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily sales" subtitle="Last 7 days revenue">
          <AnimatedBarChart
            chartId="pharmacy-daily-sales"
            points={m.dailySales.map((d) => ({
              label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
              value: d.amount,
              color: "#10b981",
            }))}
            formatValue={(n) => formatPkr(n)}
            emptyMessage="No sales in the last 7 days"
          />
        </ChartCard>

        <ChartCard title="Monthly revenue" subtitle="Last 6 months">
          <AnimatedBarChart
            chartId="pharmacy-monthly-revenue"
            points={m.monthlyRevenue.map((d) => ({
              label: d.month,
              value: d.amount,
              color: "#14b8a6",
            }))}
            formatValue={(n) => formatPkr(n)}
            emptyMessage="No monthly revenue yet"
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Sales by payment" subtitle="This month">
          <AnimatedDonutChart
            segments={paymentSegments}
            formatValue={(n) => formatPkr(n)}
            emptyMessage="No payments recorded this month"
          />
        </ChartCard>

        <ChartCard title="Stock health" subtitle="Medicine count by status">
          <AnimatedDonutChart
            segments={stockSegments}
            formatValue={(n) => String(n)}
            emptyMessage="No medicines in catalog"
          />
        </ChartCard>

        <ChartCard title="Prescriptions" subtitle="Status breakdown">
          <AnimatedDonutChart
            segments={rxSegments}
            formatValue={(n) => String(n)}
            emptyMessage="No prescriptions yet"
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Purchase trends" subtitle="Inventory purchases — last 6 months">
          <AnimatedBarChart
            chartId="pharmacy-purchase-trends"
            points={m.purchaseTrends.map((d) => ({
              label: d.month,
              value: d.amount,
              color: "#f59e0b",
            }))}
            formatValue={(n) => formatPkr(n)}
            emptyMessage="No purchases recorded"
          />
        </ChartCard>

        <ChartCard title="Stock by category" subtitle="Units on hand per category">
          <AnimatedBarChart
            chartId="pharmacy-category-stock"
            points={m.categoryStock.map((d, i) => ({
              label: d.label,
              value: d.value,
              color: CHART_COLORS[i % CHART_COLORS.length]!,
            }))}
            formatValue={(n) => String(n)}
            emptyMessage="No stock data"
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Top selling medicines</h2>
          <p className="mt-0.5 text-xs text-slate-500">This month by revenue</p>
          {m.topMedicines.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No sales data yet.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="px-4 py-2 text-left">Medicine</th>
                    <th className="px-4 py-2 text-right">Qty sold</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {m.topMedicines.map((t) => (
                    <tr key={t.name}>
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{t.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{t.qty}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatPkr(t.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Alerts & actions</h2>
              <p className="mt-0.5 text-xs text-slate-500">Stock, expiry, and operational warnings</p>
            </div>
            <Link to="/pops/pharmacy/inventory" className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400">
              View inventory
            </Link>
          </div>
          {m.alerts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No alerts — stock and expiry look good.</p>
          ) : (
            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {m.alerts.map((a) => (
                <li
                  key={`${a.type}-${a.message}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-300">{a.message}</span>
                  <Badge tone={a.severity === "danger" ? "danger" : a.severity === "warning" ? "warning" : "info"}>
                    {a.type.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <Link
              to="/pops/pharmacy/expired"
              className="rounded-lg border border-slate-200 px-3 py-2 text-center font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Expired products
            </Link>
            <Link
              to="/pops/pharmacy/profit-loss"
              className="rounded-lg border border-slate-200 px-3 py-2 text-center font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Profit / loss
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Purchases (month)" value={formatPkr(m.totalPurchasesMonth)} />
        <PharmacyStatCard label="Customers" value={m.customerCount} />
        <PharmacyStatCard
          label="Expiring batches"
          value={m.expiringCount}
          tone={m.expiringCount > 0 ? "warning" : "success"}
        />
        <PharmacyStatCard label="Medicine categories" value={m.categoryStock.length} />
      </div>
    </div>
  );
}
