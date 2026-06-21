import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchInventoryDashboard } from "../../../api/inventory";
import { formatPkr, useInventoryAccess } from "../../../hooks/useInventory";
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory dashboard"
        subtitle="Overview of ingredients, stock levels, consumption, waste, and purchase activity."
        actions={
          <>
            <Link to="/pops/inventory/purchase-orders" className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
              New PO
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
              { to: "/pops/inventory/purchase-orders", label: "Purchase orders" },
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
