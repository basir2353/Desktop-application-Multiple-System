import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createGoodsReceipt, fetchBranchInventory } from "../../../api/inventory";
import { inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

export function GoodsReceivingPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    purchaseOrderId: "",
    ingredientId: "",
    qty: "1",
    unitCost: "0",
    invoiceNumber: "",
    deliveryDate: new Date().toISOString().slice(0, 10),
    batchNumber: "",
    expiryDate: "",
    receivedBy: "",
  });

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const ing = query.data?.ingredients.find((i) => i.id === form.ingredientId);
      return createGoodsReceipt({
        branchCode: branch!.code,
        supplierId: form.supplierId,
        purchaseOrderId: form.purchaseOrderId || undefined,
        invoiceNumber: form.invoiceNumber || undefined,
        deliveryDate: form.deliveryDate,
        receivedBy: form.receivedBy || undefined,
        lines: [{
          ingredientId: form.ingredientId,
          qty: Number(form.qty),
          unit: ing?.unit ?? "Kg",
          unitCost: Number(form.unitCost),
          batchNumber: form.batchNumber || undefined,
          expiryDate: form.expiryDate || undefined,
        }],
      });
    },
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const suppliers = query.data?.suppliers.filter((s) => s.active) ?? [];
  const ingredients = query.data?.ingredients ?? [];
  const openPos = query.data?.purchaseOrders.filter((p) => p.status !== "Received" && p.status !== "Cancelled") ?? [];
  const receipts = query.data?.goodsReceipts ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Goods receiving" subtitle="Record deliveries — inventory updates automatically on save." />
      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <InventoryFormPanel title="Record GRN" submitLabel="Receive goods" onSubmit={() => createMutation.mutate()} disabled={!form.supplierId || !form.ingredientId || createMutation.isPending}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <select className={selectClass} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">Supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className={selectClass} value={form.purchaseOrderId} onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}>
              <option value="">Link PO (optional)</option>
              {openPos.map((p) => <option key={p.id} value={p.id}>{p.poNumber}</option>)}
            </select>
            <select className={selectClass} value={form.ingredientId} onChange={(e) => setForm({ ...form, ingredientId: e.target.value })}>
              <option value="">Ingredient</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input className={inputClass} type="number" placeholder="Qty received" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            <input className={inputClass} type="number" placeholder="Unit cost" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
            <input className={inputClass} placeholder="Invoice #" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
            <input className={inputClass} type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
            <input className={inputClass} placeholder="Batch #" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
            <input className={inputClass} type="date" placeholder="Expiry" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </div>
        </InventoryFormPanel>
      ) : null}

      {receipts.map((gr) => (
        <div key={gr.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-white">{gr.grnNumber}</div>
              <div className="mt-1 text-xs text-slate-500">{gr.supplierName} · Invoice {gr.invoiceNumber ?? "—"} · {gr.deliveryDate}</div>
            </div>
            <div className="text-sm text-amber-200">Rs {gr.totalCost.toLocaleString()}</div>
          </div>
          <div className="mt-3">
            <SimpleTable rowKey={(r) => r.id} columns={[
              { key: "name", header: "Ingredient" },
              { key: "qty", header: "Qty", render: (r) => `${r.qty} ${r.unit}` },
              { key: "batch", header: "Batch", render: (r) => r.batch ?? "—" },
              { key: "expiry", header: "Expiry", render: (r) => r.expiry ?? "—" },
            ]} rows={gr.items} />
          </div>
        </div>
      ))}
    </div>
  );
}
