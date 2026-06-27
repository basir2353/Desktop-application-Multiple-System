import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPharmacyDashboard, fetchPharmacySales } from "../api/pharmacy";
import { formatPkr, usePharmacyAccess } from "../hooks/usePharmacy";
import { PageHeader } from "../../pops/ui/PageHeader";

export function PharmacyFinancePage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const dashboardQuery = useQuery({
    queryKey: ["pharmacy", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyDashboard(branch!.code),
  });
  const salesQuery = useQuery({
    queryKey: ["pharmacy", "sales", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacySales(branch!.code),
  });

  if (dashboardQuery.isLoading) return <p className="text-sm text-slate-500">Loading finance…</p>;

  const m = dashboardQuery.data!;
  const sales = salesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Financial management"
        subtitle="Income, expenses, profit & loss, and cash flow for the pharmacy."
        actions={
          <div className="flex gap-2">
            <Link to="/pops/pharmacy/profit-loss" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
              Profit / loss report
            </Link>
            <Link to="/pops/pharmacy/sales-statement" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Sales statement
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4"><div className="text-xs text-slate-500">Revenue (month)</div><div className="mt-1 text-xl font-semibold">{formatPkr(m.revenueMonth)}</div></div>
        <div className="rounded-lg border p-4"><div className="text-xs text-slate-500">Profit (month)</div><div className="mt-1 text-xl font-semibold">{formatPkr(m.profitMonth)}</div></div>
        <div className="rounded-lg border p-4"><div className="text-xs text-slate-500">Purchases (month)</div><div className="mt-1 text-xl font-semibold">{formatPkr(m.totalPurchasesMonth)}</div></div>
        <div className="rounded-lg border p-4"><div className="text-xs text-slate-500">Sales today</div><div className="mt-1 text-xl font-semibold">{formatPkr(m.totalSalesToday)}</div></div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">Recent invoices</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Invoice</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {sales.slice(0, 15).map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-mono text-xs">{s.invoiceNumber}</td>
                <td className="px-4 py-2">{s.patientName ?? "Walk-in"}</td>
                <td className="px-4 py-2">{s.paymentMethod}</td>
                <td className="px-4 py-2">{formatPkr(s.total)}</td>
                <td className="px-4 py-2">{new Date(s.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
