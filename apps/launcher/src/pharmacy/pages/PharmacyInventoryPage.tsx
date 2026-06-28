import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatMedicineLocation, formatStockLabel } from "@platform/contracts";
import { fetchPharmacyMedicines, fetchPharmacyReorderSuggestions } from "../api/pharmacy";
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

  const reorderQuery = useQuery({
    queryKey: ["pharmacy", "reorder-suggestions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyReorderSuggestions(branch!.code),
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading stock…</p>;
  if (query.isError) return <p className="text-sm text-red-400">{(query.error as Error).message}</p>;

  const medicines = query.data ?? [];
  const low = medicines.filter((m) => m.currentStock > 0 && m.currentStock <= m.reorderLevel);
  const out = medicines.filter((m) => m.currentStock === 0);
  const totalValue = medicines.reduce((s, m) => s + m.purchasePrice * m.currentStock, 0);
  const reorderList = reorderQuery.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory & expiry management"
        subtitle="Stock levels, 90/60/30-day expiry alerts, reorder notifications, and rack/shelf locations."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pops/pharmacy/medicines"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
            >
              Add / receive stock
            </Link>
            <Link
              to="/pops/pharmacy/purchase-statement"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Create purchase order
            </Link>
            <Link
              to="/pops/pharmacy/expired"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Expiry reports
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <PharmacyStatCard label="Total SKUs" value={medicines.length} />
        <PharmacyStatCard label="Stock value" value={formatPkr(totalValue)} tone="success" />
        <PharmacyStatCard label="Reorder alerts" value={reorderList.length} tone={reorderList.length > 0 ? "warning" : "default"} />
      </div>

      {reorderList.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Reorder level notifications</h2>
          <p className="mt-1 text-xs text-slate-500">Medicines below minimum stock — generate a purchase request.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {reorderList.map((r) => (
              <li key={r.medicineId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/50 bg-white/60 px-3 py-2 dark:border-amber-900/40 dark:bg-slate-900/40">
                <div>
                  <span className="font-medium">{r.medicineName}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {r.currentStock} / {r.reorderLevel} min
                    {r.location ? ` · ${r.location}` : ""}
                  </span>
                </div>
                <Badge tone="warning">Order {r.suggestedReorderQty} units</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
                <Badge tone="warning">Low — {formatStockLabel(m)}</Badge>
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
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Reorder</th>
              <th className="px-4 py-2">Value</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.genericName ?? m.sku}</div>
                </td>
                <td className="px-4 py-2 text-xs text-slate-600">{formatMedicineLocation(m) ?? "—"}</td>
                <td className="px-4 py-2">{formatStockLabel(m)}</td>
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
