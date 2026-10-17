import { INGREDIENT_UNITS, type Ingredient } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  createIngredient,
  deleteIngredient,
  fetchBranchInventory,
  updateIngredient,
} from "../../../api/inventory";
import { fetchStoreProducts } from "../../../../store/api/store";
import { formatPkr, inputClass, selectClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { accentValueClass, linkActionClass, linkDangerClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { InventoryError, InventoryFormPanel, InventoryLoading, StockLeftTotal, summarizeIngredientStock } from "./InventoryUi";

function stockStatus(i: Ingredient): { label: string; tone: "success" | "warning" | "danger" } {
  const onHand = i.onHandStock ?? i.currentStock;
  if (onHand === 0) return { label: "Out of stock", tone: "danger" };
  if (onHand <= i.reorderLevel) return { label: "Low stock", tone: "warning" };
  if (onHand >= i.maxStock && i.maxStock > 0) return { label: "Overstock", tone: "warning" };
  return { label: "OK", tone: "success" };
}

type IngredientRow = {
  sku: string;
  name: string;
  categoryId: string;
  unit: (typeof INGREDIENT_UNITS)[number];
  currentStock: string;
  minStock: string;
  reorderLevel: string;
  maxStock: string;
  unitCost: string;
  storeProductId: string;
};

/** Stock level fields stay whole units (Gram/ml counts). */
function wholeNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

/** Per-unit PKR — keep decimals (e.g. 1.3 / Gram). Up to 4 dp. */
function moneyNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 10000) / 10000;
}

function stockValue(qty: number, unitCost: number): number {
  return (Number(qty) || 0) * (Number(unitCost) || 0);
}

function emptyRow(): IngredientRow {
  return {
    sku: "",
    name: "",
    categoryId: "",
    unit: "Kg",
    currentStock: "0",
    minStock: "0",
    reorderLevel: "0",
    maxStock: "0",
    unitCost: "0",
    storeProductId: "",
  };
}

export function IngredientsPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<IngredientRow[]>([emptyRow()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<IngredientRow>(emptyRow());

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });
  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });

  function updateRow(index: number, patch: Partial<IngredientRow>): void {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow(): void {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number): void {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function startEdit(ing: Ingredient): void {
    setEditingId(ing.id);
    // Prefer warehouse on-hand (what the table shows) so edit/save does not fight the ledger.
    const onHand = ing.onHandStock ?? ing.currentStock;
    setEditForm({
      sku: ing.sku,
      name: ing.name,
      categoryId: ing.categoryId ?? "",
      unit: (INGREDIENT_UNITS.includes(ing.unit as IngredientRow["unit"])
        ? ing.unit
        : "Kg") as IngredientRow["unit"],
      currentStock: String(onHand),
      minStock: String(ing.minStock),
      reorderLevel: String(ing.reorderLevel),
      maxStock: String(ing.maxStock),
      unitCost: String(ing.unitCost),
      storeProductId: ing.storeProductId ?? "",
    });
    setError(null);
  }

  const validRows = rows.filter((r) => r.sku.trim() && r.name.trim());

  const createMutation = useMutation({
    mutationFn: async () => {
      for (const row of validRows) {
        await createIngredient({
          branchCode: branch!.code,
          sku: row.sku.trim(),
          name: row.name.trim(),
          categoryId: row.categoryId || undefined,
          unit: row.unit,
          currentStock: wholeNumber(row.currentStock),
          minStock: wholeNumber(row.minStock),
          reorderLevel: wholeNumber(row.reorderLevel),
          maxStock: wholeNumber(row.maxStock),
          unitCost: moneyNumber(row.unitCost),
          storeProductId: row.storeProductId || null,
        });
      }
    },
    onSuccess: () => {
      invalidate();
      setRows([emptyRow()]);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error("No ingredient selected");
      return updateIngredient(editingId, {
        sku: editForm.sku.trim(),
        name: editForm.name.trim(),
        categoryId: editForm.categoryId.trim() ? editForm.categoryId : null,
        unit: editForm.unit,
        currentStock: wholeNumber(editForm.currentStock),
        minStock: wholeNumber(editForm.minStock),
        reorderLevel: wholeNumber(editForm.reorderLevel),
        maxStock: wholeNumber(editForm.maxStock),
        unitCost: moneyNumber(editForm.unitCost),
        storeProductId: editForm.storeProductId || null,
      });
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setEditForm(emptyRow());
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIngredient,
    onSuccess: () => {
      invalidate();
      setError(null);
      if (editingId) {
        setEditingId(null);
        setEditForm(emptyRow());
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const categories = query.data?.categories ?? [];
  const ingredients = (query.data?.ingredients ?? []).filter((i) => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || i.categoryId === categoryFilter;
    return matchSearch && matchCat;
  });
  const stockLeft = summarizeIngredientStock(ingredients);

  return (
    <div className="space-y-4">
      <PageHeader title="Ingredients" subtitle="Raw materials managed by the kitchen." />

      {error ? <InventoryError message={error} /> : null}

      {canManage && editingId ? (
        <InventoryFormPanel
          title={`Edit ingredient · ${editForm.sku || "…"}`}
          submitLabel={updateMutation.isPending ? "Saving…" : "Save changes"}
          onSubmit={() => updateMutation.mutate()}
          disabled={
            updateMutation.isPending || !editForm.sku.trim() || !editForm.name.trim()
          }
        >
          <div className="grid gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block space-y-1 text-xs text-slate-500">
              <span>SKU</span>
              <input
                className={inputClass}
                placeholder="SKU"
                value={editForm.sku}
                onChange={(e) => setEditForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs text-slate-500">
              <span>Name</span>
              <input
                className={inputClass}
                placeholder="Name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs text-slate-500">
              <span>Category</span>
              <select
                className={selectClass}
                value={editForm.categoryId}
                onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs text-slate-500">
              <span>Unit (label only — qty does not auto-convert)</span>
              <select
                className={selectClass}
                value={editForm.unit}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, unit: e.target.value as IngredientRow["unit"] }))
                }
              >
                {INGREDIENT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs text-slate-500 sm:col-span-2">
              <span>Store product mapping</span>
              <select
                className={selectClass}
                value={editForm.storeProductId}
                onChange={(e) => setEditForm((f) => ({ ...f, storeProductId: e.target.value }))}
              >
                <option value="">Store product mapping</option>
                {(productsQuery.data ?? []).map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs text-slate-500">
              <span>Current stock (on-hand)</span>
              <input
                className={inputClass}
                placeholder="Current stock"
                type="number"
                value={editForm.currentStock}
                onChange={(e) => setEditForm((f) => ({ ...f, currentStock: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs text-slate-500">
              <span>Min stock</span>
              <input
                className={inputClass}
                placeholder="Min stock"
                type="number"
                value={editForm.minStock}
                onChange={(e) => setEditForm((f) => ({ ...f, minStock: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs text-slate-500">
              <span>Reorder level</span>
              <input
                className={inputClass}
                placeholder="Reorder level"
                type="number"
                value={editForm.reorderLevel}
                onChange={(e) => setEditForm((f) => ({ ...f, reorderLevel: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs text-slate-500">
              <span>Max stock (capacity — not on-hand)</span>
              <input
                className={inputClass}
                placeholder="Max stock"
                type="number"
                value={editForm.maxStock}
                onChange={(e) => setEditForm((f) => ({ ...f, maxStock: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs text-slate-500">
              <span>Unit cost (Rs / {editForm.unit})</span>
              <input
                className={inputClass}
                placeholder="e.g. 1.3"
                type="number"
                step="any"
                min="0"
                value={editForm.unitCost}
                onChange={(e) => setEditForm((f) => ({ ...f, unitCost: e.target.value }))}
              />
            </label>
            <div className="flex flex-col justify-end space-y-1 text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
              <span>Stock value (qty × unit cost)</span>
              <div className={`rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold tabular-nums dark:border-slate-700 dark:bg-slate-900 ${accentValueClass}`}>
                {formatPkr(stockValue(wholeNumber(editForm.currentStock), moneyNumber(editForm.unitCost)))}
                <span className="ml-2 text-[11px] font-normal text-slate-400">
                  {wholeNumber(editForm.currentStock)} {editForm.unit} × {formatPkr(moneyNumber(editForm.unitCost))}
                </span>
              </div>
              <button
                type="button"
                className="self-start text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                onClick={() => {
                  setEditingId(null);
                  setEditForm(emptyRow());
                }}
              >
                Cancel edit
              </button>
            </div>
          </div>
        </InventoryFormPanel>
      ) : null}

      {canManage && !editingId ? (
        <InventoryFormPanel
          title="Add ingredients"
          submitLabel={createMutation.isPending ? "Saving…" : `Save ${validRows.length} ingredient${validRows.length === 1 ? "" : "s"}`}
          onSubmit={() => createMutation.mutate()}
          disabled={validRows.length === 0 || createMutation.isPending}
        >
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={index} className="grid gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
                <input className={inputClass} placeholder="SKU" value={row.sku} onChange={(e) => updateRow(index, { sku: e.target.value })} />
                <input className={inputClass} placeholder="Name" value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} />
                <select className={selectClass} value={row.categoryId} onChange={(e) => updateRow(index, { categoryId: e.target.value })}>
                  <option value="">Category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className={selectClass} value={row.storeProductId} onChange={(e) => updateRow(index, { storeProductId: e.target.value })}>
                  <option value="">Store product mapping</option>
                  {(productsQuery.data ?? []).map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
                <select className={selectClass} value={row.unit} onChange={(e) => updateRow(index, { unit: e.target.value as IngredientRow["unit"] })}>
                  {INGREDIENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input className={inputClass} placeholder="Current stock" type="number" value={row.currentStock} onChange={(e) => updateRow(index, { currentStock: e.target.value })} />
                <input className={inputClass} placeholder="Min stock" type="number" value={row.minStock} onChange={(e) => updateRow(index, { minStock: e.target.value })} />
                <input className={inputClass} placeholder="Reorder level" type="number" value={row.reorderLevel} onChange={(e) => updateRow(index, { reorderLevel: e.target.value })} />
                <div className="flex items-center gap-2">
                  <input className={`flex-1 ${inputClass}`} placeholder="Unit cost (Rs)" type="number" step="any" min="0" value={row.unitCost} onChange={(e) => updateRow(index, { unitCost: e.target.value })} />
                  <button
                    type="button"
                    className={`text-xs ${linkDangerClass} disabled:opacity-40`}
                    onClick={() => removeRow(index)}
                    disabled={rows.length === 1}
                    aria-label="Remove row"
                    title="Remove row"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
            >
              + Add another ingredient
            </button>
          </div>
        </InventoryFormPanel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input placeholder="Search name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className={`min-w-[12rem] flex-1 sm:max-w-xs ${inputClass}`} />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <StockLeftTotal
        title="Stock left — overall"
        hint={
          search || categoryFilter
            ? "Is filter ki list ka total — kitna stock bacha hai (on-hand × unit cost)."
            : "Har ingredient alag hai. Ye total hai ke ab kitna stock bacha hai (on-hand × unit cost)."
        }
        total={stockLeft.total}
        parts={stockLeft.parts}
      />

      <SimpleTable<Ingredient>
        rowKey={(r) => r.id}
        columns={[
          { key: "sku", header: "SKU" },
          { key: "name", header: "Ingredient" },
          { key: "categoryName", header: "Category", render: (r) => r.categoryName ?? "—" },
          { key: "unit", header: "Unit" },
          {
            key: "onHandStock",
            header: "On hand",
            render: (r) => {
              const onHand = r.onHandStock ?? r.currentStock;
              return (
                <span className={onHand <= r.reorderLevel ? accentValueClass : ""}>
                  {onHand} {r.unit}
                </span>
              );
            },
          },
          {
            key: "kitchenStock",
            header: "Kitchen / Store",
            render: (r) => {
              const kitchen = r.kitchenStock ?? 0;
              const store = r.storeStock ?? Math.max(0, (r.onHandStock ?? r.currentStock) - kitchen);
              const sections = (r.kitchenSections ?? []).filter((s) => s.quantity > 0);
              return (
                <span className="text-slate-300">
                  <span>K:{kitchen}</span>
                  {sections.length > 0 ? (
                    <span className="ml-1 text-[10px] text-amber-200/80">
                      (
                      {sections
                        .map((s) => `${s.name}:${s.quantity}`)
                        .join(" · ")}
                      )
                    </span>
                  ) : null}
                  {store > 0 ? (
                    <span className="ml-1 text-[10px] text-slate-500">· Store:{store}</span>
                  ) : null}
                </span>
              );
            },
          },
          { key: "reorderLevel", header: "Reorder at" },
          {
            key: "unitCost",
            header: "Unit cost",
            render: (r) => formatPkr(r.unitCost),
          },
          {
            id: "stockValue",
            key: "unitCost",
            header: "Stock value",
            render: (r) => {
              const qty = r.onHandStock ?? r.currentStock;
              return (
                <span className={accentValueClass}>
                  {formatPkr(stockValue(qty, r.unitCost))}
                </span>
              );
            },
          },
          { id: "status", key: "id", header: "Status", render: (r) => { const s = stockStatus(r); return <Badge tone={s.tone}>{s.label}</Badge>; } },
          ...(canManage
            ? [
                {
                  id: "actions",
                  key: "id" as const,
                  header: "",
                  render: (r: Ingredient) => (
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        className={`text-xs ${linkActionClass}`}
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`text-xs ${linkDangerClass}`}
                        onClick={() => {
                          if (window.confirm(`Delete ingredient “${r.name}”?`)) {
                            deleteMutation.mutate(r.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
        rows={ingredients}
      />
    </div>
  );
}
