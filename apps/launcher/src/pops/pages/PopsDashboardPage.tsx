import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useAdaptiveRefetchInterval } from "../../lib/useAdaptiveRefetchInterval";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import { fetchAccountingDashboard } from "../api/accounting";
import { fetchCompletedOrders } from "../api/billing";
import { fetchKitchenTickets } from "../api/kitchen";
import { fetchDashboard, SessionExpiredError, isSessionExpiredError } from "../api/operations";
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
  karachiTime,
  payableCompletedOrders,
  salesMetricsFromOrders,
  timeToMinutes,
} from "../lib/orderSales";
import { PageHeader } from "../ui/PageHeader";
import { erpEntryPathForRole, sessionCanManageUsers } from "../lib/roleAccess";
import { format12Hour, TimeAmPmInput } from "../components/TimeAmPmInput";

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

const ZOOM_LEVELS = [0.6, 0.75, 0.85, 1, 1.15, 1.3, 1.5] as const;

export function PopsDashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const claims = useSessionStore((s) => s.claims);
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const canViewDashboard = sessionCanManageUsers(claims);
  const ordersPollMs = useAdaptiveRefetchInterval(15_000);
  const dashboardPollMs = useAdaptiveRefetchInterval(45_000);
  const pendingPollMs = useAdaptiveRefetchInterval(8_000);
  const accountingPollMs = useAdaptiveRefetchInterval(60_000);

  useEffect(() => {
    if (!canViewDashboard) {
      navigate(erpEntryPathForRole("restaurant", displayRole), { replace: true });
    }
  }, [canViewDashboard, displayRole, navigate]);

  const [businessDay, setBusinessDay] = useState<BusinessDaySettings>(() =>
    loadBusinessDaySettings(branch?.code),
  );
  const todayKey = useMemo(() => currentBusinessDateKey(businessDay), [businessDay]);
  const [fromDate, setFromDate] = useState(todayKey);
  const [toDate, setToDate] = useState(todayKey);
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [zoomIndex, setZoomIndex] = useState(3);

  useEffect(() => {
    setBusinessDay(loadBusinessDaySettings(branch?.code));
    const key = currentBusinessDateKey(loadBusinessDaySettings(branch?.code));
    setFromDate(key);
    setToDate(key);
    setFromTime("");
    setToTime("");
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
    queryKey: ["orders", branch?.code, fromDate, toDate],
    enabled: Boolean(branch?.code),
    refetchInterval: ordersPollMs,
    queryFn: () =>
      fetchCompletedOrders(branch!.code, {
        scope: "dashboard",
        since: fromDate ? `${fromDate}T00:00:00.000+05:00` : undefined,
      }),
  });

  const dashboardQuery = useQuery({
    queryKey: ["operations", "dashboard", accessToken, branch?.code],
    enabled: Boolean(accessToken && branch?.code),
    refetchInterval: dashboardPollMs,
    queryFn: () => fetchDashboard(branch!.code),
  });

  const pendingQuery = useQuery({
    queryKey: ["kitchen", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: pendingPollMs,
    queryFn: () => fetchKitchenTickets(branch!.code),
  });

  const accountingQuery = useQuery({
    queryKey: ["accounting", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: accountingPollMs,
    queryFn: () => fetchAccountingDashboard(branch!.code),
  });

  const completedOrdersForSales = useMemo(
    () => payableCompletedOrders(ordersQuery.data ?? []),
    [ordersQuery.data],
  );

  const dateFilteredOrders = useMemo(() => {
    if (!fromDate && !toDate && !fromTime && !toTime) return completedOrdersForSales;
    return completedOrdersForSales.filter((order) => {
      const key = businessDateKey(order.createdAt, businessDay);
      if (fromDate && key < fromDate) return false;
      if (toDate && key > toDate) return false;
      if (fromTime || toTime) {
        const mins = timeToMinutes(karachiTime(order.createdAt));
        if (fromTime && mins < timeToMinutes(fromTime)) return false;
        if (toTime && mins > timeToMinutes(toTime)) return false;
      }
      return true;
    });
  }, [completedOrdersForSales, fromDate, toDate, fromTime, toTime, businessDay]);

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
    const expired =
      isSessionExpiredError(dashboardQuery.error) || isSessionExpiredError(ordersQuery.error);
    if (expired) {
      navigate("/role", { replace: true });
      return;
    }
    const message = dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "";
    if (message.startsWith("Branch not found")) {
      usePopsStore.getState().clearBranch();
      navigate("/pops/branches", { replace: true });
    }
  }, [dashboardQuery.error, ordersQuery.error, navigate]);

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
      hint: dashboardQuery.isError
        ? "Inventory metrics unavailable — other dashboard data still works"
        : metrics
          ? `${metrics.lowStock.criticalCount} critical reorder`
          : "Loading inventory…",
    },
  ];

  const showInsights = !ordersQuery.isLoading && !ordersQuery.isError;
  const showPulse = Boolean(branch?.code);

  if (!canViewDashboard) {
    return <p className="text-sm text-slate-400">Redirecting…</p>;
  }

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

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Date &amp; time filter</h2>
            <p className="text-[10px] text-slate-500">
              Filters live pulse, sales, charts, and items sold (business day · PKT).
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20"
              onClick={() => {
                setFromDate(todayKey);
                setToDate(todayKey);
                setFromTime("");
                setToTime("");
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-2.5 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
              onClick={() => {
                const d = new Date(`${todayKey}T12:00:00`);
                d.setDate(d.getDate() - 1);
                const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                setFromDate(y);
                setToDate(y);
                setFromTime("");
                setToTime("");
              }}
            >
              Yesterday
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-2.5 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
              onClick={() => {
                const end = new Date(`${todayKey}T12:00:00`);
                const start = new Date(end);
                start.setDate(start.getDate() - 6);
                const fmt = (d: Date) =>
                  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                setFromDate(fmt(start));
                setToDate(fmt(end));
                setFromTime("");
                setToTime("");
              }}
            >
              Last 7 days
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
        <div className="h-10 w-px self-end bg-slate-800" aria-hidden />
        <div className="text-xs text-slate-400">
          From time
          <TimeAmPmInput className="mt-1" value={fromTime} onChange={setFromTime} aria-label="From time" />
        </div>
        <div className="text-xs text-slate-400">
          To time
          <TimeAmPmInput className="mt-1" value={toTime} onChange={setToTime} aria-label="To time" />
        </div>
        {fromTime || toTime ? (
          <button
            type="button"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            onClick={() => {
              setFromTime("");
              setToTime("");
            }}
          >
            Clear time
          </button>
        ) : null}
        <span className="text-xs text-slate-500">
          {fromTime || toTime
            ? `${format12Hour(fromTime) || "12:00 AM"} – ${format12Hour(toTime) || "11:59 PM"} (PKT)`
            : formatBusinessDayRange(businessDay)}{" "}
          · {dateFilteredOrders.length} orders in range
        </span>
        </div>
      </div>

      {dashboardQuery.isError && !isSessionExpiredError(dashboardQuery.error) ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Dashboard metrics could not load ({(dashboardQuery.error as Error).message}). Sales and
          kitchen counts below still update from live orders.
        </div>
      ) : null}

      {ordersQuery.isError && !isSessionExpiredError(ordersQuery.error) ? (
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

            {accountingQuery.data &&
            (accountingQuery.data.monthlyRevenue > 0 ||
              accountingQuery.data.totalExpenses > 0 ||
              Math.abs(accountingQuery.data.profitLoss) > 0 ||
              accountingQuery.data.cashInHand > 0 ||
              accountingQuery.data.bankBalance > 0) ? (
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="dashboard-section-title">Finance (accounting)</h2>
                  <Link to="/pops/accounting" className="dashboard-finance-link">
                    Open accounting →
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Monthly revenue", value: formatPkr(accountingQuery.data.monthlyRevenue), show: accountingQuery.data.monthlyRevenue > 0 },
                    { label: "Month expenses", value: formatPkr(accountingQuery.data.totalExpenses), show: accountingQuery.data.totalExpenses > 0 },
                    { label: "Profit / loss", value: formatPkr(accountingQuery.data.profitLoss), show: Math.abs(accountingQuery.data.profitLoss) > 0 },
                    {
                      label: "Cash + bank",
                      value: formatPkr(accountingQuery.data.cashInHand + accountingQuery.data.bankBalance),
                      show: accountingQuery.data.cashInHand + accountingQuery.data.bankBalance > 0,
                    },
                  ]
                    .filter((c) => c.show)
                    .map((c) => (
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
