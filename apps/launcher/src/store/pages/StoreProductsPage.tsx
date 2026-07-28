import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StoreProduct } from "@platform/contracts";
import {
  createStoreProduct,
  deleteStoreProduct,
  fetchStoreBrands,
  fetchStoreCategories,
  fetchStoreProducts,
  fetchStoreSuppliers,
  fetchStoreUnits,
  updateStoreProduct,
} from "../api/store";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import {
  downloadStoreProductImportTemplate,
  importRowToCreatePayload,
  parseStoreProductImportFile,
} from "../lib/productImportExport";
import { StoreField, StoreFormSection, StoreInput, StoreSelect, StoreDataTable } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";

type ItemFormState = {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  brandId: string;
  unitId: string;
  supplierId: string;
  upc: string;
  aluCodes: string[];
  purchasePrice: number;
  orderCost: number;
  sellingPrice: number;
  salePrice: number;
  mrpPrice: number;
  wholesalePrice: number;
  customPrice: number;
  marketSalePrice: number;
  marginPct: number;
  markupPct: number;
  taxPct: number;
  reorderLevel: number;
  availableStock: number;
  isWeighed: boolean;
  color: string;
  size: string;
  serialNumbers: string;
};

const emptyForm = (): ItemFormState => ({
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  brandId: "",
  unitId: "",
  supplierId: "",
  upc: "",
  aluCodes: [],
  purchasePrice: 0,
  orderCost: 0,
  sellingPrice: 0,
  salePrice: 0,
  mrpPrice: 0,
  wholesalePrice: 0,
  customPrice: 0,
  marketSalePrice: 0,
  marginPct: 0,
  markupPct: 0,
  taxPct: 0,
  reorderLevel: 10,
  availableStock: 0,
  isWeighed: false,
  color: "",
  size: "",
  serialNumbers: "",
});

function calcMargin(price: number, cost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}

function calcMarkup(price: number, cost: number): number {
  if (cost <= 0) return 0;
  return Math.round(((price - cost) / cost) * 100);
}

function productToForm(p: StoreProduct): ItemFormState {
  const codes = (p.barcodes?.length ? p.barcodes : p.barcode ? [p.barcode] : []).filter(Boolean);
  return {
    sku: p.sku,
    name: p.name,
    description: p.description ?? "",
    categoryId: p.categoryId ?? "",
    brandId: p.brandId ?? "",
    unitId: p.unitId ?? "",
    supplierId: p.supplierId ?? "",
    upc: codes[0] ?? p.barcode ?? "",
    aluCodes: codes.slice(1),
    purchasePrice: p.purchasePrice,
    orderCost: p.orderCost ?? 0,
    sellingPrice: p.sellingPrice,
    salePrice: p.salePrice ?? 0,
    mrpPrice: p.mrpPrice ?? 0,
    wholesalePrice: p.wholesalePrice ?? 0,
    customPrice: p.customPrice ?? 0,
    marketSalePrice: p.marketSalePrice ?? 0,
    marginPct: p.marginPct ?? 0,
    markupPct: p.markupPct ?? 0,
    taxPct: p.taxPct,
    reorderLevel: p.reorderLevel,
    availableStock: p.availableStock,
    isWeighed: p.isWeighed,
    color: p.color ?? "",
    size: p.size ?? "",
    serialNumbers: (p.serialNumbers ?? []).join(", "),
  };
}

function collectBarcodes(form: ItemFormState): string[] {
  const all = [form.upc, ...form.aluCodes].map((c) => c.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const code of all) {
    if (!unique.includes(code)) unique.push(code);
  }
  return unique.slice(0, 12);
}

export function StoreProductsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(true);
  const [marginManual, setMarginManual] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(emptyForm);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });
  const categoriesQuery = useQuery({
    queryKey: ["store", "categories", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreCategories(branch!.code),
  });
  const brandsQuery = useQuery({
    queryKey: ["store", "brands", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreBrands(branch!.code),
  });
  const unitsQuery = useQuery({
    queryKey: ["store", "units", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreUnits(branch!.code),
  });
  const suppliersQuery = useQuery({
    queryKey: ["store", "suppliers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreSuppliers(branch!.code),
  });

  const parentCategories = useMemo(
    () => (categoriesQuery.data ?? []).filter((c) => !c.parentId),
    [categoriesQuery.data],
  );

  const lowStockCount = useMemo(
    () =>
      (productsQuery.data ?? []).filter(
        (p) => p.availableStock > 0 && p.availableStock <= p.reorderLevel,
      ).length,
    [productsQuery.data],
  );

  useEffect(() => {
    if (marginManual) return;
    setForm((prev) => ({
      ...prev,
      marginPct: calcMargin(prev.sellingPrice, prev.purchasePrice),
      markupPct: calcMarkup(prev.sellingPrice, prev.purchasePrice),
    }));
  }, [form.sellingPrice, form.purchasePrice, marginManual]);

  function openCreate(): void {
    setEditingId(null);
    setForm(emptyForm());
    setMarginManual(false);
    setShowPricing(true);
    setShowForm(true);
    setError(null);
  }

  function openEdit(p: StoreProduct): void {
    setEditingId(p.id);
    setForm(productToForm(p));
    setMarginManual(true);
    setShowPricing(true);
    setShowForm(true);
    setError(null);
  }

  function buildPayload() {
    const barcodes = collectBarcodes(form);
    const autoSku =
      form.sku.trim() ||
      `ST-${String(Date.now()).slice(-8)}`;
    return {
      branchCode: branch!.code,
      sku: editingId ? form.sku.trim() || undefined : autoSku,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      categoryId: form.categoryId || undefined,
      brandId: form.brandId || undefined,
      unitId: form.unitId || undefined,
      supplierId: form.supplierId || undefined,
      barcode: barcodes[0],
      barcodes,
      purchasePrice: form.purchasePrice,
      orderCost: form.orderCost,
      sellingPrice: form.sellingPrice,
      salePrice: form.salePrice,
      mrpPrice: form.mrpPrice,
      wholesalePrice: form.wholesalePrice,
      customPrice: form.customPrice,
      marketSalePrice: form.marketSalePrice,
      marginPct: form.marginPct,
      markupPct: form.markupPct,
      taxPct: form.taxPct,
      reorderLevel: form.reorderLevel,
      availableStock: editingId ? undefined : form.availableStock,
      isWeighed: form.isWeighed,
      color: form.color.trim() || undefined,
      size: form.size.trim() || undefined,
      serialNumbers: form.serialNumbers
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  const saveMutation = useMutation({
    mutationFn: async (mode: "save" | "save-new") => {
      if (!form.name.trim()) throw new Error("Item name is required");
      const barcodes = collectBarcodes(form);
      if (barcodes.length > 12) throw new Error("Maximum 12 barcodes per item");
      const payload = buildPayload();
      if (editingId) {
        const { branchCode: _b, availableStock: _a, ...updateBody } = payload;
        await updateStoreProduct(editingId, updateBody);
      } else {
        await createStoreProduct({ ...payload, availableStock: form.availableStock });
      }
      return mode;
    },
    onSuccess: (mode) => {
      invalidate();
      setNotice(editingId ? "Item updated" : "Item created");
      setError(null);
      if (mode === "save-new") {
        setEditingId(null);
        setForm(emptyForm());
        setMarginManual(false);
        setShowForm(true);
      } else {
        setShowForm(false);
        setEditingId(null);
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStoreProduct(id),
    onSuccess: () => {
      invalidate();
      setNotice("Product deleted");
    },
    onError: (e: Error) => setError(e.message),
  });

  async function handleImportFile(file: File): Promise<void> {
    if (!branch?.code) return;
    setImporting(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseStoreProductImportFile(buffer);
      if (rows.length === 0) throw new Error("No valid item rows found in the file");
      let created = 0;
      const errors: string[] = [];
      for (const row of rows) {
        try {
          await createStoreProduct(importRowToCreatePayload(row, branch.code));
          created += 1;
        } catch (e) {
          errors.push(`${row.name}: ${(e as Error).message}`);
        }
      }
      invalidate();
      setNotice(
        `Import finished: ${created} created` +
          (errors.length ? `, ${errors.length} failed` : ""),
      );
      if (errors.length) setError(errors.slice(0, 5).join("; "));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  const barcodeSlotsUsed = collectBarcodes(form).length;
  const canAddAlu = barcodeSlotsUsed < 12;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Product master"
        subtitle="Item creation with departments, multi-barcode (UPC + ALU), vendors, and price levels. Import supports name, qty, serial, barcodes (3–10), cost, sale price, description, color, and size."
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => downloadStoreProductImportTemplate(branch?.code)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                Download import template
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => importInputRef.current?.click()}
                className="rounded-lg border border-sky-600/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-500/20 disabled:opacity-50 dark:text-sky-200"
              >
                {importing ? "Importing…" : "Import item list"}
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => (showForm ? (setShowForm(false), setEditingId(null)) : openCreate())}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              >
                {showForm ? "Cancel" : "Add inventory item"}
              </button>
            </div>
          ) : undefined
        }
      />

      {lowStockCount > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Low-stock alert: {lowStockCount} item{lowStockCount === 1 ? "" : "s"} at or below reorder point.
        </div>
      ) : null}

      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {showForm ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {editingId ? "Edit Inventory Item" : "Add Inventory Item"}
            </h2>
            <p className="text-xs text-slate-500">{barcodeSlotsUsed}/12 barcodes</p>
          </div>

          <StoreFormSection title="Basic info" description="Name, department, stock, and primary UPC">
            <StoreField label="Item name" required>
              <StoreInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Product name"
              />
            </StoreField>
            <StoreField label="Department" hint="Category such as Grocery, Drinks, or a company name">
              <StoreSelect
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Select department</option>
                {parentCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </StoreSelect>
            </StoreField>
            <StoreField label="Brand">
              <StoreSelect
                value={form.brandId}
                onChange={(e) => setForm({ ...form, brandId: e.target.value })}
              >
                <option value="">Select brand</option>
                {(brandsQuery.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </StoreSelect>
            </StoreField>
            <StoreField label="Unit">
              <StoreSelect
                value={form.unitId}
                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              >
                <option value="">Select unit</option>
                {(unitsQuery.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </StoreSelect>
            </StoreField>
            <div className="col-span-full sm:col-span-2 lg:col-span-4">
              <StoreField label="Description">
                <textarea
                  className="min-h-[72px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Item description"
                />
              </StoreField>
            </div>
            <StoreField label="Color">
              <StoreInput
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="e.g. Blue"
              />
            </StoreField>
            <StoreField label="Size">
              <StoreInput
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                placeholder="e.g. L / 42"
              />
            </StoreField>
            <StoreField label="Serial number(s)" hint="Comma-separated">
              <StoreInput
                value={form.serialNumbers}
                onChange={(e) => setForm({ ...form, serialNumbers: e.target.value })}
                placeholder="SN-001, SN-002"
              />
            </StoreField>
            <StoreField label="Regular price">
              <StoreInput
                type="number"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
              />
            </StoreField>
            <StoreField label="Avg. unit cost">
              <StoreInput
                type="number"
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
              />
            </StoreField>
            <StoreField label="On-hand qty" hint={editingId ? "Edit stock via Stock movement" : "Opening stock"}>
              <StoreInput
                type="number"
                disabled={Boolean(editingId)}
                value={form.availableStock}
                onChange={(e) => setForm({ ...form, availableStock: Number(e.target.value) })}
              />
            </StoreField>
            <StoreField label="Tax %">
              <StoreInput
                type="number"
                value={form.taxPct}
                onChange={(e) => setForm({ ...form, taxPct: Number(e.target.value) })}
              />
            </StoreField>
            <StoreField label="UPC (barcode)" hint="Primary barcode">
              <StoreInput
                value={form.upc}
                onChange={(e) => setForm({ ...form, upc: e.target.value })}
                placeholder="Scan or enter barcode"
              />
            </StoreField>
            <label className="col-span-full flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isWeighed}
                onChange={(e) => setForm({ ...form, isWeighed: e.target.checked })}
              />
              Sold by weight (stock in grams, price per kg)
            </label>
          </StoreFormSection>

          <StoreFormSection title="More info" description="Vendor, reorder, item number, and ALU barcodes">
            <StoreField label="Vendor">
              <StoreSelect
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              >
                <option value="">Select vendor</option>
                {(suppliersQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </StoreSelect>
            </StoreField>
            <StoreField label="Order cost">
              <StoreInput
                type="number"
                value={form.orderCost}
                onChange={(e) => setForm({ ...form, orderCost: Number(e.target.value) })}
              />
            </StoreField>
            <StoreField label="Reorder point" hint="Low-stock alert when on-hand reaches this level">
              <StoreInput
                type="number"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })}
              />
            </StoreField>
            <StoreField label="Item no." hint="Leave blank to auto-generate (ST-000001)">
              <StoreInput
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder={editingId ? form.sku : "Auto"}
                readOnly={Boolean(editingId)}
              />
            </StoreField>
            <div className="col-span-full space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  ALU / alternate barcodes (up to 12 total with UPC)
                </p>
                <button
                  type="button"
                  disabled={!canAddAlu}
                  onClick={() => setForm({ ...form, aluCodes: [...form.aluCodes, ""] })}
                  className="text-xs font-semibold text-sky-700 disabled:opacity-40 dark:text-sky-300"
                >
                  + Add ALU
                </button>
              </div>
              {form.aluCodes.length === 0 ? (
                <p className="text-xs text-slate-500">No alternate barcodes yet.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {form.aluCodes.map((code, index) => (
                    <div key={`alu-${index}`} className="flex gap-2">
                      <StoreInput
                        value={code}
                        onChange={(e) => {
                          const next = [...form.aluCodes];
                          next[index] = e.target.value;
                          setForm({ ...form, aluCodes: next });
                        }}
                        placeholder={`ALU ${index + 1}`}
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-2 text-xs text-red-600 dark:border-slate-700"
                        onClick={() =>
                          setForm({
                            ...form,
                            aluCodes: form.aluCodes.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </StoreFormSection>

          <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <button
              type="button"
              className="mb-3 flex w-full items-center justify-between text-left"
              onClick={() => setShowPricing((v) => !v)}
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pricing</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Regular, sale, MRP, wholesale, custom, market sale, margin &amp; markup
                </p>
              </div>
              <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
                {showPricing ? "Hide" : "Show"}
              </span>
            </button>
            {showPricing ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StoreField label="Regular price">
                  <StoreInput
                    type="number"
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                  />
                </StoreField>
                <StoreField label="Sale price">
                  <StoreInput
                    type="number"
                    value={form.salePrice}
                    onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })}
                  />
                </StoreField>
                <StoreField label="MRP price">
                  <StoreInput
                    type="number"
                    value={form.mrpPrice}
                    onChange={(e) => setForm({ ...form, mrpPrice: Number(e.target.value) })}
                  />
                </StoreField>
                <StoreField label="Wholesale rate">
                  <StoreInput
                    type="number"
                    value={form.wholesalePrice}
                    onChange={(e) => setForm({ ...form, wholesalePrice: Number(e.target.value) })}
                  />
                </StoreField>
                <StoreField label="Custom rate">
                  <StoreInput
                    type="number"
                    value={form.customPrice}
                    onChange={(e) => setForm({ ...form, customPrice: Number(e.target.value) })}
                  />
                </StoreField>
                <StoreField label="Market sale price">
                  <StoreInput
                    type="number"
                    value={form.marketSalePrice}
                    onChange={(e) => setForm({ ...form, marketSalePrice: Number(e.target.value) })}
                  />
                </StoreField>
                <StoreField label="Cost">
                  <StoreInput
                    type="number"
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
                  />
                </StoreField>
                <StoreField label="Margin %" hint="(Price − Cost) / Price">
                  <StoreInput
                    type="number"
                    value={form.marginPct}
                    onChange={(e) => {
                      setMarginManual(true);
                      setForm({ ...form, marginPct: Number(e.target.value) });
                    }}
                  />
                </StoreField>
                <StoreField label="Markup %" hint="(Price − Cost) / Cost">
                  <StoreInput
                    type="number"
                    value={form.markupPct}
                    onChange={(e) => {
                      setMarginManual(true);
                      setForm({ ...form, markupPct: Number(e.target.value) });
                    }}
                  />
                </StoreField>
                <div className="col-span-full">
                  <button
                    type="button"
                    className="text-xs font-medium text-sky-700 dark:text-sky-300"
                    onClick={() => {
                      setMarginManual(false);
                      setForm((prev) => ({
                        ...prev,
                        marginPct: calcMargin(prev.sellingPrice, prev.purchasePrice),
                        markupPct: calcMarkup(prev.sellingPrice, prev.purchasePrice),
                      }));
                    }}
                  >
                    Recalculate margin &amp; markup from Regular vs Cost
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate("save")}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
            {!editingId ? (
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate("save-new")}
                className="rounded-lg border border-sky-600/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-500/20 disabled:opacity-50 dark:text-sky-200"
              >
                Save &amp; New
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <StoreDataTable
        columns={["Item no.", "Name", "Department", "UPC", "Stock", "Regular", "Vendor", "Status", ""]}
        rows={(productsQuery.data ?? []).map((p) => [
          p.sku,
          p.name,
          p.categoryName ?? "—",
          p.barcode ?? (p.barcodes?.[0] ?? "—"),
          p.availableStock,
          formatPkr(p.sellingPrice),
          p.supplierName ?? "—",
          p.availableStock === 0 ? (
            <Badge tone="danger">Out</Badge>
          ) : p.availableStock <= p.reorderLevel ? (
            <Badge tone="warning">Low</Badge>
          ) : (
            <Badge tone="success">OK</Badge>
          ),
          canManage ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(p)}
                className="text-xs text-sky-700 hover:underline dark:text-sky-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(p.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          ) : null,
        ])}
      />
    </div>
  );
}
