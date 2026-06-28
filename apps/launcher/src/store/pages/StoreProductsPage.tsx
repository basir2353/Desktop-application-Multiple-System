import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createStoreProduct, deleteStoreProduct, fetchStoreBrands, fetchStoreCategories, fetchStoreProducts, fetchStoreUnits } from "../api/store";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { StoreField, StoreFormSection, StoreInput, StoreSelect } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";

export function StoreProductsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    sku: "", name: "", description: "", categoryId: "", brandId: "", unitId: "",
    barcode: "", purchasePrice: 0, sellingPrice: 0, taxPct: 0, reorderLevel: 10, availableStock: 0,
    trackBatch: false, isWeighed: false, batchNumber: "", expiryDate: "",
  });

  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });
  const categoriesQuery = useQuery({ queryKey: ["store", "categories", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreCategories(branch!.code) });
  const brandsQuery = useQuery({ queryKey: ["store", "brands", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreBrands(branch!.code) });
  const unitsQuery = useQuery({ queryKey: ["store", "units", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreUnits(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStoreProduct({
      branchCode: branch!.code,
      sku: form.sku,
      name: form.name,
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      brandId: form.brandId || undefined,
      unitId: form.unitId || undefined,
      barcode: form.barcode || undefined,
      purchasePrice: form.purchasePrice,
      sellingPrice: form.sellingPrice,
      taxPct: form.taxPct,
      reorderLevel: form.reorderLevel,
      availableStock: form.availableStock,
      trackBatch: form.trackBatch,
      isWeighed: form.isWeighed,
      batchNumber: form.batchNumber || undefined,
      expiryDate: form.expiryDate || undefined,
    }),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setNotice("Product created");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStoreProduct(id),
    onSuccess: () => { invalidate(); setNotice("Product deleted"); },
    onError: (e: Error) => setError(e.message),
  });

  const parentCategories = (categoriesQuery.data ?? []).filter((c) => !c.parentId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Product master"
        subtitle="Manage SKUs, pricing, barcodes, variants, and reorder levels."
        actions={canManage ? (
          <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500">
            {showForm ? "Cancel" : "Add product"}
          </button>
        ) : undefined}
      />

      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {showForm ? (
        <StoreFormSection title="New product" description="Fill in product details">
          <StoreField label="SKU" required><StoreInput value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></StoreField>
          <StoreField label="Product name" required><StoreInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></StoreField>
          <StoreField label="Category">
            <StoreSelect value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Select category</option>
              {parentCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </StoreSelect>
          </StoreField>
          <StoreField label="Brand">
            <StoreSelect value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
              <option value="">Select brand</option>
              {(brandsQuery.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </StoreSelect>
          </StoreField>
          <StoreField label="Unit">
            <StoreSelect value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
              <option value="">Select unit</option>
              {(unitsQuery.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </StoreSelect>
          </StoreField>
          <StoreField label="Barcode"><StoreInput value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></StoreField>
          <StoreField label="Purchase price"><StoreInput type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} /></StoreField>
          <StoreField label="Selling price"><StoreInput type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} /></StoreField>
          <StoreField label="Tax %"><StoreInput type="number" value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: Number(e.target.value) })} /></StoreField>
          <StoreField label="Reorder level"><StoreInput type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} /></StoreField>
          <StoreField label="Opening stock"><StoreInput type="number" value={form.availableStock} onChange={(e) => setForm({ ...form, availableStock: Number(e.target.value) })} /></StoreField>
          <label className="col-span-full flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isWeighed} onChange={(e) => setForm({ ...form, isWeighed: e.target.checked })} />
            Sold by weight (stock in grams, price per kg)
          </label>
          <div className="col-span-full">
            <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">
              Save product
            </button>
          </div>
        </StoreFormSection>
      ) : null}

      <StoreDataTable
        columns={["SKU", "Name", "Category", "Brand", "Stock", "Price", "Value", "Status", ""]}
        rows={(productsQuery.data ?? []).map((p) => [
          p.sku,
          p.name,
          p.categoryName ?? "—",
          p.brandName ?? "—",
          p.availableStock,
          formatPkr(p.sellingPrice),
          formatPkr(p.inventoryValue),
          p.availableStock === 0 ? <Badge tone="danger">Out</Badge> : p.availableStock <= p.reorderLevel ? <Badge tone="warning">Low</Badge> : <Badge tone="success">OK</Badge>,
          canManage ? <button type="button" onClick={() => deleteMutation.mutate(p.id)} className="text-xs text-red-600 hover:underline">Delete</button> : null,
        ])}
      />
    </div>
  );
}
