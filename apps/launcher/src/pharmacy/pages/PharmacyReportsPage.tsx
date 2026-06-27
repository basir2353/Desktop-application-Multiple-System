import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPharmacyDashboard, fetchPharmacyMedicines, fetchPharmacySales } from "../api/pharmacy";
import { formatPkr, usePharmacyAccess } from "../hooks/usePharmacy";
import { PageHeader } from "../../pops/ui/PageHeader";
import { PharmacyStatCard } from "../ui/PharmacyUi";

const reportLinks = [
  { to: "/pops/pharmacy/sales-month", label: "Sales of the month" },
  { to: "/pops/pharmacy/profit-loss", label: "Profit / loss" },
  { to: "/pops/pharmacy/expired", label: "Expired products" },
  { to: "/pops/pharmacy/sales-statement", label: "Sales statement" },
];

export function PharmacyReportsPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const dashboardQuery = useQuery({
    queryKey: ["pharmacy", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDashboard(branch!.code),
  });
  const medicinesQuery = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });
  const salesQuery = useQuery({
    queryKey: ["pharmacy", "sales", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacySales(branch!.code),
  });

  if (dashboardQuery.isLoading) return <p className="text-sm text-slate-500">Loading reports…</p>;

  const m = dashboardQuery.data!;
  const lowStock = (medicinesQuery.data ?? []).filter((x) => x.currentStock > 0 && x.currentStock <= x.reorderLevel);
  const outOfStock = (medicinesQuery.data ?? []).filter((x) => x.currentStock === 0);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const expiring = (medicinesQuery.data ?? []).filter(
    (x) => x.nearestExpiry && x.nearestExpiry >= today && x.nearestExpiry <= in30Str,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports hub"
        subtitle="Linked analytics across sales, inventory, and finance."
        actions={
          <Link
            to="/pops/pharmacy/dashboard"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Open dashboard
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Sales today" value={formatPkr(m.totalSalesToday)} tone="success" />
        <PharmacyStatCard label="Monthly revenue" value={formatPkr(m.revenueMonth)} />
        <PharmacyStatCard label="Profit (month)" value={formatPkr(m.profitMonth)} tone={m.profitMonth >= 0 ? "success" : "danger"} />
        <PharmacyStatCard label="Transactions" value={(salesQuery.data ?? []).length} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Stock units" value={m.availableStock} />
        <PharmacyStatCard label="Low stock" value={lowStock.length} tone="warning" />
        <PharmacyStatCard label="Out of stock" value={outOfStock.length} tone="danger" />
        <PharmacyStatCard label="Expiring (30d)" value={m.expiringCount} tone="warning" />
      </div>

      <div className="flex flex-wrap gap-2">
        {reportLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Top medicines (this month)</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {m.topMedicines.length === 0 ? (
            <li className="text-slate-500">No sales data yet.</li>
          ) : (
            m.topMedicines.map((t) => (
              <li key={t.name} className="flex justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                <span className="font-medium text-slate-900 dark:text-white">{t.name}</span>
                <span className="text-slate-500">
                  {t.qty} sold · {formatPkr(t.revenue)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Expiry watch list</h2>
          <Link to="/pops/pharmacy/expired" className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            View all expired
          </Link>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {expiring.length === 0 ? (
            <li className="text-slate-500">No medicines expiring in the next 30 days.</li>
          ) : (
            expiring.slice(0, 10).map((x) => (
              <li key={x.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                <span>{x.name}</span>
                <span className="text-amber-600 dark:text-amber-400">{x.nearestExpiry}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
