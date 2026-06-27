import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPharmacyMedicines } from "../api/pharmacy";
import { formatPkr, usePharmacyAccess } from "../hooks/usePharmacy";
import { PageHeader } from "../../pops/ui/PageHeader";
import { Badge } from "../../pops/ui/Badge";
import { PharmacyStatCard } from "../ui/PharmacyUi";

export function PharmacyInventoryPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const query = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading stock…</p>;
  if (query.isError) return <p className="text-sm text-red-400">{(query.error as Error).message}</p>;

  const medicines = query.data ?? [];
  const low = medicines.filter((m) => m.currentStock > 0 && m.currentStock <= m.reorderLevel);
  const out = medicines.filter((m) => m.currentStock === 0);
  const totalValue = medicines.reduce((s, m) => s + m.purchasePrice * m.currentStock, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory management"
        subtitle="Current stock, incoming/outgoing tracking, and low-stock alerts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pops/pharmacy/medicines"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
            >
              Add / receive stock
            </Link>
            <Link
              to="/pops/pharmacy/expired"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Expired products
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <PharmacyStatCard label="Total SKUs" value={medicines.length} />
        <PharmacyStatCard label="Stock value" value={formatPkr(totalValue)} tone="success" />
        <PharmacyStatCard label="Alerts" value={low.length + out.length} tone={low.length + out.length > 0 ? "warning" : "default"} />
      </div>

      {(low.length > 0 || out.length > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Stock alerts</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {out.map((m) => (
              <li key={m.id} className="flex justify-between">
                <span>{m.name}</span>
                <Badge tone="danger">Out of stock</Badge>
              </li>
            ))}
            {low.map((m) => (
              <li key={m.id} className="flex justify-between">
                <span>{m.name}</span>
                <Badge tone="warning">Low — {m.currentStock} left</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900/80">
            <tr>
              <th className="px-4 py-2">Medicine</th>
              <th className="px-4 py-2">Current</th>
              <th className="px-4 py-2">Reorder</th>
              <th className="px-4 py-2">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {medicines.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 font-medium">{m.name}</td>
                <td className="px-4 py-2">{m.currentStock}</td>
                <td className="px-4 py-2">{m.reorderLevel}</td>
                <td className="px-4 py-2">{formatPkr(m.purchasePrice * m.currentStock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
