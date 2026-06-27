import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatedBarChart } from "../../pops/components/dashboard/AnimatedBarChart";
import { AnimatedDonutChart } from "../../pops/components/dashboard/AnimatedDonutChart";
import { PageHeader } from "../../pops/ui/PageHeader";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass } from "../../pops/lib/themeClasses";
import { fetchStoreDashboard } from "../api/store";
import { formatPkr, useStoreAccess } from "../hooks/useStore";
import { StoreStatCard } from "../ui/StoreUi";

const CHART_COLORS = ["#0ea5e9", "#6366f1", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981"];

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function StoreDashboardPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const dashboardQuery = useQuery({
    queryKey: ["store", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 30_000,
    queryFn: () => fetchStoreDashboard(branch!.code),
  });

  if (dashboardQuery.isLoading) {
    return <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">Loading store dashboard…</div>;
  }
  if (dashboardQuery.isError) {
    return <div className={noticeErrorClass}>{(dashboardQuery.error as Error).message}</div>;
  }

  const m = dashboardQuery.data!;
  const isProfit = m.profitMonth >= 0;

  const stockSegments = m.stockHealth.map((s, i) => ({
    label: s.label,
    value: s.value,
    color: CHART_COLORS[i % CHART_COLORS.length]!,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store dashboard"
        subtitle={`Inventory overview for ${branch?.name ?? "branch"} — stock, sales, purchases, and alerts.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/pops/store/pos" className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500">
              Open POS
            </Link>
            <Link to="/pops/store/purchase/orders" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Purchase orders
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StoreStatCard label="Sales today" value={formatPkr(m.totalSalesToday)} tone="success" />
        <StoreStatCard label="Revenue (month)" value={formatPkr(m.revenueMonth)} />
        <StoreStatCard label="Profit (month)" value={formatPkr(m.profitMonth)} tone={isProfit ? "success" : "danger"} />
        <StoreStatCard label="Bills today" value={m.transactionCountToday} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StoreStatCard label="Total products" value={m.totalProducts} />
        <StoreStatCard label="Inventory value" value={formatPkr(m.inventoryValue)} />
        <StoreStatCard label="Available stock" value={m.availableStock.toLocaleString()} />
        <StoreStatCard label="Pending POs" value={m.pendingPurchaseOrders} tone={m.pendingPurchaseOrders > 0 ? "warning" : "default"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StoreStatCard label="Low stock" value={m.lowStockCount} tone="warning" />
        <StoreStatCard label="Out of stock" value={m.outOfStockCount} tone={m.outOfStockCount > 0 ? "danger" : "default"} />
        <StoreStatCard label="Expiring soon" value={m.expiringCount} tone="warning" />
        <StoreStatCard label="Warehouses" value={m.warehouseCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily sales" subtitle="Last 7 days">
          <AnimatedBarChart
            chartId="store-daily-sales"
            points={m.dailySales.map((d) => ({
              label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
              value: d.amount,
              color: "#0ea5e9",
            }))}
          />
        </ChartCard>
        <ChartCard title="Monthly purchases vs sales" subtitle="Last 6 months">
          <AnimatedBarChart
            chartId="store-monthly"
            points={m.monthlySales.flatMap((s, i) => [
              { label: `${s.month} S`, value: s.amount, color: "#0ea5e9" },
              { label: `${m.monthlyPurchases[i]?.month ?? ""} P`, value: m.monthlyPurchases[i]?.amount ?? 0, color: "#6366f1" },
            ])}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Stock health">
          <AnimatedDonutChart segments={stockSegments} formatValue={(n) => String(n)} emptyMessage="No stock data" />
        </ChartCard>
        <ChartCard title="Category stock">
          <AnimatedDonutChart
            segments={m.categoryStock.map((c, i) => ({ label: c.label, value: c.value, color: CHART_COLORS[i % CHART_COLORS.length]! }))}
            formatValue={(n) => String(n)}
            emptyMessage="No category data"
          />
        </ChartCard>
        <ChartCard title="Warehouse summary">
          <ul className="space-y-2">
            {m.warehouseSummary.map((w) => (
              <li key={w.name} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-200">{w.name}</span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-white">{w.stock.toLocaleString()} units · {formatPkr(w.value)}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Top selling products</h2>
          <ul className="mt-3 space-y-2">
            {m.topSellingProducts.length === 0 ? (
              <li className="text-xs text-slate-500">No sales data yet</li>
            ) : (
              m.topSellingProducts.map((p) => (
                <li key={p.sku} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="tabular-nums text-slate-600">{p.qty} sold · {formatPkr(p.revenue)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Alerts</h2>
          <ul className="mt-3 space-y-2">
            {m.alerts.length === 0 ? (
              <li className="text-xs text-slate-500">All clear — no alerts</li>
            ) : (
              m.alerts.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge tone={a.severity === "danger" ? "danger" : a.severity === "warning" ? "warning" : "neutral"}>{a.type.replace(/_/g, " ")}</Badge>
                  <span className="text-slate-600 dark:text-slate-300">{a.message}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent transactions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700">
                <th className="pb-2 pr-4">Product</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Qty</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {m.recentTransactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-4">{t.productName}</td>
                  <td className="py-2 pr-4 capitalize">{t.type.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-4 tabular-nums">{t.qty}</td>
                  <td className="py-2 text-slate-500">{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
