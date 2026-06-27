import { useQuery } from "@tanstack/react-query";
import { fetchStoreBatches, fetchStoreProducts } from "../api/store";
import { useStoreAccess } from "../hooks/useStore";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { Badge } from "../../pops/ui/Badge";

export function StoreBatchesPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const batchesQuery = useQuery({ queryKey: ["store", "batches", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreBatches(branch!.code) });

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader title="Batch, serial & expiry" subtitle="Track batch numbers, lot numbers, expiry dates, and recall management." />
      <StoreDataTable
        columns={["Product", "Batch", "Lot", "Expiry", "Qty", "Status"]}
        rows={(batchesQuery.data ?? []).map((b) => {
          const exp = b.expiryDate ?? "";
          let tone: "danger" | "warning" | "success" = "success";
          if (exp && exp <= today) tone = "danger";
          else if (exp && exp <= in30Str) tone = "warning";
          return [
            b.productName, b.batchNumber, b.lotNumber ?? "—", exp || "—", b.quantity,
            <Badge tone={tone}>{exp && exp <= today ? "Expired" : exp && exp <= in30Str ? "Expiring" : "Active"}</Badge>,
          ];
        })}
      />
    </div>
  );
}

export function StoreBarcodePage(): JSX.Element {
  const { branch } = useStoreAccess();
  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });

  return (
    <div className="space-y-5">
      <PageHeader title="Barcode & QR management" subtitle="View barcodes, generate QR codes, and prepare labels for printing." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(productsQuery.data ?? []).map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-sm font-semibold">{p.name}</p>
            <p className="text-xs text-slate-500">{p.sku}</p>
            <div className="mt-3 rounded-lg bg-slate-100 p-4 text-center font-mono text-lg dark:bg-slate-800">
              {p.barcode ?? p.qrCode ?? "No barcode"}
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-400">Scan or print label</p>
          </div>
        ))}
      </div>
    </div>
  );
}
