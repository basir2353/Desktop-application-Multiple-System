import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import { fetchAccountingDashboard } from "../api/accounting";
import { fetchCompletedOrders } from "../api/billing";
import { fetchKitchenTickets } from "../api/kitchen";
import { fetchDashboard, SessionExpiredError } from "../api/operations";
import { DashboardChartsGrid } from "../components/dashboard/DashboardChartsGrid";
import { summarizePendingOrders } from "../lib/pendingOrdersMetrics";
import {
  loadBusinessDaySettings,
  formatBusinessDayRange,
  BUSINESS_DAY_CHANGED_EVENT,
  type BusinessDaySettings,
} from "../lib/businessDay";
import {
  businessDateKey,
  currentBusinessDateKey,
  payableCompletedOrders,
  salesMetricsFromOrders,
} from "../lib/orderSales";
import { PageHeader } from "../ui/PageHeader";

function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

function slaLabel(status: "green" | "yellow" | "red"): string {
  if (status === "green") return "SLA green";
  if (status === "yellow") return "SLA yellow";
  return "SLA red";
}

type TopProduct = { label: string; qty: number; revenue: number };

function topProductsAlphabetical(orders: ReturnType<typeof payableCompletedOrders>): TopProduct[] {
  const map = new Map<string, TopProduct>();
  for (const order of orders) {
    for (const line of order.lines) {
      const existing = map.get(line.label) ?? { label: line.label, qty: 0, revenue: 0 };
      existing.qty += line.qty;
      existing.revenue += line.unitPrice * line.qty;
      map.set(line.label, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const ZOOM_LEVELS = [0.85, 1, 1.15, 1.3] as const;

export function PopsDashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const claims = useSessionStore((s) => s.claims);
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = usePopsStore((s) => s.branch);
  const [businessDay, setBusinessDay] = useState<BusinessDaySettings>(() =>
    loadBusinessDaySettings(branch?.code),
  );
  const todayKey = useMemo(() => currentBusinessDateKey(businessDay), [businessDay]);
  const [fromDate, setFromDate] = useState(todayKey);
  const [toDate, setToDate] = useState(todayKey);
  const [zoomIndex, setZoomIndex] = useState(1);

  useEffect(() => {
    setBusinessDay(loadBusinessDaySettings(branch?.code));
    const key = currentBusinessDateKey(loadBusinessDaySettings(branch?.code));
    setFromDate(key);
    setToDate(key);
  }, [branch?.code]);

  useEffect(() => {
    function onBusinessDayChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        setBusinessDay(loadBusinessDaySettings(branch?.code));
      }
    }
    window.addEventListener(BUSINESS_DAY_CHANGED_EVENT, onBusinessDayChanged);
    return () => window.removeEventListener(BUSINESS_DAY_CHANGED_EVENT, onBusinessDayChanged);
  }, [branch?.code]);

  const ordersQuery = useQuery({
    queryKey: ["orders", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 10_000,
    queryFn: () => fetchCompletedOrders(branch!.code),
  });

  const dashboardQuery = useQuery({
    queryKey: ["operations", "dashboard", accessToken, branch?.code],
    enabled: Boolean(accessToken && branch?.code),
    refetchInterval: 30_000,
    queryFn: () => fetchDashboard(branch!.code),
  });

  const pendingQuery = useQuery({
    queryKey: ["kitchen", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 5_000,
    queryFn: () => fetchKitchenTickets(branch!.code),
  });

  const accountingQuery = useQuery({
    queryKey: ["accounting", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 60_000,
    queryFn: () => fetchAccountingDashboard(branch!.code),
  });

  const completedOrdersForSales = useMemo(
    () => payableCompletedOrders(ordersQuery.data ?? []),
    [ordersQuery.data],
  );

  const dateFilteredOrders = useMemo(() => {
    if (!fromDate && !toDate) return completedOrdersForSales;
    return completedOrdersForSales.filter((order) => {
      const key = businessDateKey(order.createdAt, businessDay);
      if (fromDate && key < fromDate) return false;
      if (toDate && key > toDate) return false;
      return true;
    });
  }, [completedOrdersForSales, fromDate, toDate, businessDay]);

  const topProducts = useMemo(
    () => topProductsAlphabetical(dateFilteredOrders),
    [dateFilteredOrders],
  );

  const pendingSummary = useMemo(
    () => summarizePendingOrders(pendingQuery.data ?? []),
    [pendingQuery.data],
  );

  const orderSales = useMemo(
    () => salesMetricsFromOrders(dateFilteredOrders, businessDay),
    [dateFilteredOrders, businessDay],
  );

  useEffect(() => {
    if (dashboardQuery.error instanceof SessionExpiredError) {
      navigate("/login", { replace: true });
    }
  }, [dashboardQuery.error, navigate]);

  const metrics = dashboardQuery.data?.metrics;
  const zoom = ZOOM_LEVELS[zoomIndex];

  const salesHint =
    orderSales.todayAmountPkr > 0
      ? `${orderSales.changePercent >= 0 ? "+" : ""}${orderSales.changePercent}% vs yesterday · ${orderSales.orderCount} orders in range`
      : orderSales.orderCount > 0
        ? `${orderSales.orderCount} orders in selected range`
        : "Pay or complete orders — totals match POS → Orders";

  const statCards = [
    {
      label: fromDate === toDate && fromDate === todayKey ? "Sales (today)" : "Sales (range)",
      value: ordersQuery.isLoading ? "…" : formatPkr(orderSales.allCompletedAmountPkr),
      hint: `${fromDate} → ${toDate} · ${salesHint}`,
    },
    {
      label: "Active orders",
      value: pendingQuery.isLoading ? "…" : String(pendingSummary.total),
      hint: `${pendingSummary.newCount} new · ${pendingSummary.cookingCount} cooking · ${pendingSummary.readyCount} ready`,
    },
    {
      label: "Pending orders",
      value: pendingQuery.isLoading ? "…" : String(pendingSummary.total),
      hint: `${pendingSummary.priorityCount} priority · ${slaLabel(pendingSummary.slaStatus)}`,
    },
    {
      label: "Low stock SKUs",
      value: dashboardQuery.isLoading ? "…" : String(metrics?.lowStock.skuCount ?? 0),
      hint: metrics
        ? `${metrics.lowStock.criticalCount} critical reorder`
        : "Loading inventory…",
    },
  ];

  const showInsights = !ordersQuery.isLoading && !ordersQuery.isError;
  const showPulse = Boolean(branch?.code);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operations dashboard"
        subtitle={`Signed in as ${claims?.sub ?? "—"} · Branch ${branch?.name ?? "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
              disabled={zoomIndex === 0}
            >
              Zoom out
            </button>
            <span className="text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            >
              Zoom in
            </button>
            <Link
              to="/pops/closing"
              className="rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-amber-500"
            >
              End of day
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <label className="text-xs text-slate-400">
          From date
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          To date
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <button
          type="button"
          className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          onClick={() => {
            setFromDate(todayKey);
            setToDate(todayKey);
          }}
        >
          Today
        </button>
        <span className="text-xs text-slate-500">
          {formatBusinessDayRange(businessDay)} · {dateFilteredOrders.length} orders in range
        </span>
      </div>

      {dashboardQuery.isError && !(dashboardQuery.error instanceof SessionExpiredError) ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {(dashboardQuery.error as Error).message}
        </div>
      ) : null}

      {ordersQuery.isError ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Could not load completed orders for sales: {(ordersQuery.error as Error).message}
        </p>
      ) : null}

      <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }}>
        {showPulse ? (
          <>
            <section>
              <h2 className="dashboard-section-title">Live pulse</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {statCards.map((c) => (
                  <div key={c.label} data-ui="dashboard-stat-card">
                    <div className="dashboard-stat-label">{c.label}</div>
                    <div className="dashboard-stat-value">{c.value}</div>
                    <div className="dashboard-stat-hint">{c.hint}</div>
                  </div>
                ))}
              </div>
            </section>

            {topProducts.length > 0 ? (
              <section className="mt-6">
                <h2 className="dashboard-section-title">Items sold (A–Z)</h2>
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p) => (
                        <tr key={p.label} className="border-t border-slate-800/60">
                          <td className="px-3 py-2 text-slate-200">{p.label}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-400">{p.qty}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                            {formatPkr(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {showInsights && metrics ? (
              <DashboardChartsGrid
                completedOrders={dateFilteredOrders}
                metrics={metrics}
                pendingTickets={pendingQuery.data ?? []}
                businessDay={businessDay}
              />
            ) : null}

            {accountingQuery.data ? (
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="dashboard-section-title">Finance (accounting)</h2>
                  <Link to="/pops/accounting" className="dashboard-finance-link">
                    Open accounting →
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Monthly revenue", value: formatPkr(accountingQuery.data.monthlyRevenue) },
                    { label: "Month expenses", value: formatPkr(accountingQuery.data.totalExpenses) },
                    { label: "Profit / loss", value: formatPkr(accountingQuery.data.profitLoss) },
                    {
                      label: "Cash + bank",
                      value: formatPkr(accountingQuery.data.cashInHand + accountingQuery.data.bankBalance),
                    },
                  ].map((c) => (
                    <div key={c.label} className="dashboard-finance-card">
                      <div className="dashboard-finance-label">{c.label}</div>
                      <div className="dashboard-stat-value text-xl">{c.value}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
