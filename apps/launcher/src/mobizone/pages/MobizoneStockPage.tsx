import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr } from "../lib/mobizoneStore";
import { MzField, MzInput, MzSelect } from "../ui/MobizoneUi";

export function MobizoneStockPage(): JSX.Element {
  const { db } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "in_stock" | "sold">("in_stock");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.devices.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!needle) return true;
      return (
        d.imei.toLowerCase().includes(needle) ||
        d.brand.toLowerCase().includes(needle) ||
        d.model.toLowerCase().includes(needle) ||
        (d.colour ?? "").toLowerCase().includes(needle)
      );
    });
  }, [db.devices, q, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phone stock"
        subtitle="Every handset with brand, model, colour, storage, condition, and IMEI."
      />
      <div className="flex flex-wrap gap-3">
        <MzField label="Search">
          <MzInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="IMEI, brand, model…" className="min-w-[220px]" />
        </MzField>
        <MzField label="Status">
          <MzSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="in_stock">In stock</option>
            <option value="sold">Sold</option>
            <option value="all">All</option>
          </MzSelect>
        </MzField>
      </div>
      <div className={`${cardClass} overflow-x-auto`}>
        <table className="min-w-full text-left text-sm">
          <thead className={`border-b border-slate-200 text-xs uppercase tracking-wide ${mutedClass} dark:border-slate-800`}>
            <tr>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">IMEI</th>
              <th className="px-4 py-3">Specs</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={`px-4 py-8 text-center ${mutedClass}`}>
                  No devices match.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800/80">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {d.brand} {d.model}
                    <div className={`text-xs ${mutedClass}`}>{d.condition}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{d.imei}</td>
                  <td className={`px-4 py-3 ${mutedClass}`}>
                    {[d.colour, d.storage].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatPkr(d.purchasePricePkr)}</td>
                  <td className="px-4 py-3 capitalize">{d.status.replace("_", " ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
