import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchStoreProducts, recordStoreStockMovement } from "../api/store";
import { useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { StoreField, StoreFormSection, StoreInput, StoreSelect } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";

export function StoreStockMovementPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: "", type: "stock_in" as "stock_in" | "stock_out" | "adjustment" | "opening_stock", qty: 1, notes: "", batchNumber: "", expiryDate: "" });

  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });

  const movementMutation = useMutation({
    mutationFn: () => recordStoreStockMovement({
      branchCode: branch!.code,
      productId: form.productId,
      type: form.type,
      qty: form.qty,
      notes: form.notes || undefined,
      batchNumber: form.batchNumber || undefined,
      expiryDate: form.expiryDate || undefined,
    }),
    onSuccess: () => { invalidate(); setNotice("Stock movement recorded"); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Stock in / out / adjustment" subtitle="Record stock movements — stock in, stock out, adjustments, and opening stock." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {canManage ? (
        <StoreFormSection title="Record movement">
          <StoreField label="Product" required>
            <StoreSelect value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">Select product</option>
              {(productsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.availableStock} avail)</option>)}
            </StoreSelect>
          </StoreField>
          <StoreField label="Movement type">
            <StoreSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
              <option value="stock_in">Stock in</option>
              <option value="stock_out">Stock out</option>
              <option value="adjustment">Adjustment</option>
              <option value="opening_stock">Opening stock</option>
            </StoreSelect>
          </StoreField>
          <StoreField label="Quantity"><StoreInput type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></StoreField>
          <StoreField label="Notes"><StoreInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></StoreField>
          {form.type === "stock_in" ? (
            <>
              <StoreField label="Batch number"><StoreInput value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} /></StoreField>
              <StoreField label="Expiry date"><StoreInput type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></StoreField>
            </>
          ) : null}
          <div className="col-span-full">
            <button type="button" onClick={() => movementMutation.mutate()} disabled={!form.productId || movementMutation.isPending} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">Record movement</button>
          </div>
        </StoreFormSection>
      ) : null}
    </div>
  );
}
