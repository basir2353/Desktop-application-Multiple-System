import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchInventoryDashboard } from "../../../api/inventory";
import { formatPkr, useInventoryAccess } from "../../../hooks/useInventory";
import {
  loadStockAlertSettings,
  saveStockAlertSettings,
  STOCK_ALERT_SETTINGS_CHANGED_EVENT,
  type StockAlertSettings,
} from "../../../lib/stockAlertSettings";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { InventoryError, InventoryLoading } from "./InventoryUi";
import { InventoryFlowBanner } from "./InventoryFlowBanner";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function InventoryDashboardPage(): JSX.Element {
  const { branch } = useInventoryAccess();
  const [alertSettings, setAlertSettings] = useState<StockAlertSettings>(() =>
    loadStockAlertSettings(branch?.code),
  );
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  useEffect(() => {
    setAlertSettings(loadStockAlertSettings(branch?.code));
  }, [branch?.code]);

  useEffect(() => {
    function onChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        setAlertSettings(loadStockAlertSettings(branch?.code));
      }
    }
    window.addEventListener(STOCK_ALERT_SETTINGS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(STOCK_ALERT_SETTINGS_CHANGED_EVENT, onChanged);
  }, [branch?.code]);

  const dashboardQuery = useQuery({
    queryKey: ["inventory", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 30_000,
    queryFn: () => fetchInventoryDashboard(branch!.code),
  });

  if (dashboardQuery.isLoading) return <InventoryLoading label="Loading dashboard…" />;
  if (dashboardQuery.isError) {
    return <InventoryError message={(dashboardQuery.error as Error).message} />;
  }

  const m = dashboardQuery.data!;

  function saveAlerts(next: StockAlertSettings): void {
    if (!branch?.code) return;
    saveStockAlertSettings(branch.code, next);
    setAlertSettings(next);
    setAlertNotice("Stock alert settings saved.");
    window.setTimeout(() => setAlertNotice(null), 3000);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory dashboard"
        subtitle="Overview of ingredients, stock levels, consumption, waste, and purchase activity."
        actions={
          <>
            <Link to="/pops/inventory/purchase-orders" className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
              Kitchen demand
            </Link>
            <Link to="/pops/inventory/goods-receiving" className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
              Receive goods
            </Link>
            <Link to="/pops/inventory/stock-count" className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500">
              Stock count
            </Link>
          </>
        }
      />

      <InventoryFlowBanner />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-sm font-medium text-white">Automatic quantity alerts</div>
        <p className="mt-1 text-xs text-slate-500">
          Notify when stock reaches each ingredient&apos;s reorder level (set on Ingredients). Optional buffer
          triggers the alert earlier.
        </p>
        {alertNotice ? (
          <p className="mt-2 text-xs text-emerald-300">{alertNotice}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={alertSettings.autoNotifyEnabled}
              onChange={(e) =>
                saveAlerts({ ...alertSettings, autoNotifyEnabled: e.target.checked })
              }
            />
            Enable automatic stock notifications
          </label>
          <label className="block text-xs text-slate-400">
            Extra buffer (units above reorder level)
            <input
              type="number"
              min={0}
              max={10000}
              className="mt-1 w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
              value={alertSettings.notifyBufferQty}
              disabled={!alertSettings.autoNotifyEnabled}
              onChange={(e) =>
                saveAlerts({
                  ...alertSettings,
                  notifyBufferQty: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total ingredients" value={String(m.totalIngredients)} />
        <StatCard label="Inventory value" value={formatPkr(m.inventoryValue)} />
        <StatCard label="Low stock items" value={String(m.lowStockItems)} hint="Below reorder level" />
        <StatCard label="Out of stock" value={String(m.outOfStockItems)} hint="Needs immediate reorder" />
        <StatCard label="Expiring (7 days)" value={String(m.expiringItems)} />
        <StatCard label="Today's consumption" value={formatPkr(m.todaysConsumption)} hint="From recipes & POS" />
        <StatCard label="Waste today" value={formatPkr(m.wasteToday)} />
        <StatCard label="Purchase cost (month)" value={formatPkr(m.purchaseCostThisMonth)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Alerts</div>
          {m.alerts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No alerts — stock levels look good.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {m.alerts.map((a) => (
                <li key={a.message} className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-slate-300">{a.message}</span>
                  <Badge tone={a.severity === "danger" ? "danger" : a.severity === "warning" ? "warning" : "info"}>
                    {a.type}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Quick links</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { to: "/pops/inventory/ingredients", label: "Ingredients" },
              { to: "/pops/inventory/recipes", label: "Recipes" },
              { to: "/pops/inventory/purchase-orders", label: "Kitchen demand / PO" },
              { to: "/pops/inventory/waste", label: "Waste" },
              { to: "/pops/inventory/stock", label: "Stock management" },
              { to: "/pops/inventory/reports", label: "Reports" },
            ].map((link) => (
              <Link key={link.to} to={link.to} className="rounded-lg border border-slate-700/80 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 transition hover:border-amber-500/40 hover:text-amber-200">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
