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
import { payableCompletedOrders, salesMetricsFromOrders } from "../lib/orderSales";
import { PageHeader } from "../ui/PageHeader";

function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

function slaLabel(status: "green" | "yellow" | "red"): string {
  if (status === "green") return "SLA green";
  if (status === "yellow") return "SLA yellow";
  return "SLA red";
}

export function PopsDashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const claims = useSessionStore((s) => s.claims);
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = usePopsStore((s) => s.branch);
  const [businessDay, setBusinessDay] = useState<BusinessDaySettings>(() =>
    loadBusinessDaySettings(branch?.code),
  );

  useEffect(() => {
    setBusinessDay(loadBusinessDaySettings(branch?.code));
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

  const pendingSummary = useMemo(
    () => summarizePendingOrders(pendingQuery.data ?? []),
    [pendingQuery.data],
  );

  const completedOrdersForSales = useMemo(
    () => payableCompletedOrders(ordersQuery.data ?? []),
    [ordersQuery.data],
  );

  const orderSales = useMemo(
    () => salesMetricsFromOrders(completedOrdersForSales, businessDay),
    [completedOrdersForSales, businessDay],
  );

  useEffect(() => {
    if (dashboardQuery.error instanceof SessionExpiredError) {
      navigate("/login", { replace: true });
    }
  }, [dashboardQuery.error, navigate]);

  const metrics = dashboardQuery.data?.metrics;

  const salesHint =
    orderSales.todayAmountPkr > 0
      ? `${orderSales.changePercent >= 0 ? "+" : ""}${orderSales.changePercent}% vs yesterday · ${orderSales.orderCount} on Orders`
      : orderSales.orderCount > 0
        ? `${orderSales.orderCount} completed on Orders · none today yet`
        : "Pay or complete orders — totals match POS → Orders";

  const statCards = [
    {
      label: "Sales (today)",
      value: ordersQuery.isLoading ? "…" : formatPkr(orderSales.todayAmountPkr),
      hint: `${formatBusinessDayRange(businessDay)} · ${salesHint}`,
    },
    {
      label: "Active orders",
      value: pendingQuery.isLoading ? "…" : String(pendingSummary.total),
      hint: `${pendingSummary.newCount} new · ${pendingSummary.cookingCount} cooking · ${pendingSummary.readyCount} ready · Pending orders`,
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
          <Link
            to="/pops/closing"
            className="rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-amber-500"
          >
            End of day
          </Link>
        }
      />

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

          {showInsights && metrics ? (
            <DashboardChartsGrid
              completedOrders={completedOrdersForSales}
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
                  { label: "Cash + bank", value: formatPkr(accountingQuery.data.cashInHand + accountingQuery.data.bankBalance) },
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
  );
}
