import { useQuery } from "@tanstack/react-query";
import { fetchPharmacyBatches } from "../api/pharmacy";
import { usePharmacyAccess } from "../hooks/usePharmacy";
import { PageHeader } from "../../pops/ui/PageHeader";
import { Badge } from "../../pops/ui/Badge";

function expiryTone(expiry: string): "success" | "warning" | "danger" {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in60 = new Date();
  in60.setDate(in60.getDate() + 60);
  if (expiry <= today) return "danger";
  if (expiry <= in30.toISOString().slice(0, 10)) return "danger";
  if (expiry <= in60.toISOString().slice(0, 10)) return "warning";
  return "success";
}

export function PharmacyExpiryPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const query = useQuery({
    queryKey: ["pharmacy", "batches", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyBatches(branch!.code),
  });

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading batches…</p>;
  if (query.isError) return <p className="text-sm text-red-400">{(query.error as Error).message}</p>;

  const batches = (query.data ?? []).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  return (
    <div className="space-y-4">
      <PageHeader title="Expiry & batch management" subtitle="Track batch numbers, manufacturing dates, and expiry alerts (30/60/90 days)." />

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900/80">
            <tr>
              <th className="px-4 py-2">Medicine</th>
              <th className="px-4 py-2">Batch</th>
              <th className="px-4 py-2">Mfg date</th>
              <th className="px-4 py-2">Expiry</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {batches.map((b) => {
              const tone = expiryTone(b.expiryDate);
              return (
                <tr key={b.id}>
                  <td className="px-4 py-2 font-medium">{b.medicineName}</td>
                  <td className="px-4 py-2 font-mono text-xs">{b.batchNumber}</td>
                  <td className="px-4 py-2">{b.manufacturingDate ?? "—"}</td>
                  <td className="px-4 py-2">{b.expiryDate}</td>
                  <td className="px-4 py-2">{b.quantity}</td>
                  <td className="px-4 py-2">
                    <Badge tone={tone}>{tone === "danger" ? "Expiring" : tone === "warning" ? "Near expiry" : "OK"}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
